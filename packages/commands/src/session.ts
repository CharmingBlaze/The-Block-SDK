import { evaluateDocumentClip } from "@modeling-kit/animation";
import {
  Emitter,
  createIdFactory,
  emptyResourceDiagnostics,
  type BoneId,
  type EditorEvents,
  type IdFactory,
  type MeshId,
  type SDKResourceDiagnostics,
  type SkeletonId,
  type TextureId,
  type VertexId,
} from "@modeling-kit/core";
import {
  bumpDocumentRevisions,
  bytesToBase64,
  base64ToBytes,
  createModelDocument,
  parseDocument,
  serializeDocument,
  type AnimationClipData,
  type ModelDocument,
} from "@modeling-kit/document";
import { CommandManager, type Command, type CommandContext } from "@modeling-kit/history";
import type { TransformData } from "@modeling-kit/math";
import {
  deserializeMesh,
  serializeMesh,
  type HalfEdgeMesh,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { skeletonFromData } from "@modeling-kit/rigging";
import { clearSceneChildren } from "@modeling-kit/scene";
import { SelectionManager } from "@modeling-kit/selection";
import { TextureBuffer, PaintEngine, type BrushOptions } from "@modeling-kit/paint";
import {
  TransformGesture,
  transformsNearlyEqual,
  type TransformDelta,
  type TransformRequest,
} from "@modeling-kit/transform";
import { SetTransformsCommand } from "./set-transforms";
import { PaintStrokeCommand } from "./paint-stroke";
import { SessionCapabilities } from "./capabilities";

export class ModelingSession {
  readonly document: ModelDocument;
  readonly events = new Emitter<EditorEvents>();
  readonly ids: IdFactory;
  readonly selection = new SelectionManager();
  readonly history: CommandManager;
  readonly meshes = new Map<MeshId, HalfEdgeMesh>();
  readonly textures = new Map<TextureId, TextureBuffer>();
  poseLocals = new Map<BoneId, TransformData>();
  objectPoseLocals = new Map<string, TransformData>();
  animationTime = 0;
  readonly capabilities = new SessionCapabilities(() => ({
    canUndo: this.canUndo,
    canRedo: this.canRedo,
    selectionDomain: this.selection.domain,
    selectedCount: this.selection.elementIds.length,
    objectCount: this.selection.objectIds.length,
    hasMesh: this.meshes.size > 0,
    isTransforming: this.isTransforming,
  }));
  private gesture: TransformGesture | null = null;
  private paintStroke: { textureId: TextureId; engine: PaintEngine } | null = null;
  private disposed = false;

  constructor(options: { document?: ModelDocument | undefined; ids?: IdFactory | undefined } = {}) {
    this.ids = options.ids ?? createIdFactory();
    this.document = options.document ?? createModelDocument({ ids: this.ids });
    this.history = new CommandManager((state) => {
      this.events.emit("history:changed", state);
    });
    this.hydrateMeshes();
    this.hydrateTextures();
    this.selection.onChange((snapshot) => {
      bumpDocumentRevisions(this.document, ["selection"]);
      this.events.emit("selection:changed", {
        domain: snapshot.domain,
        ids: snapshot.elementIds.length > 0 ? snapshot.elementIds : snapshot.objectIds,
      });
    });
  }

  execute<T>(command: Command<T>): T {
    this.assertOpen();
    return this.history.execute(command, this.context());
  }

  undo(): void {
    this.assertOpen();
    this.history.undo(this.context());
  }

  redo(): void {
    this.assertOpen();
    this.history.redo(this.context());
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  beginTransform(request: TransformRequest = { mode: "translate" }): void {
    this.assertOpen();
    if (this.gesture) {
      throw new Error("A transform gesture is already active; commit or cancel it first");
    }
    const objectIds = request.objectIds ?? this.selection.objectIds;
    const vertexIds =
      request.vertexIds ??
      (this.selection.domain === "vertex" ? (this.selection.elementIds as VertexId[]) : undefined);
    const meshId =
      request.meshId ??
      (vertexIds && vertexIds.length > 0 ? this.meshIdForObject(objectIds[0]) : undefined);
    this.gesture = new TransformGesture(
      {
        document: this.document,
        meshes: this.meshes,
        emit: () => {
          this.events.emit("document:changed", { aspect: "scene", kind: "transform", objectIds });
          if (meshId) {
            this.events.emit("mesh:changed", { meshIds: [meshId], kind: "positions" });
          }
        },
      },
      {
        ...request,
        objectIds,
        ...(meshId !== undefined ? { meshId } : {}),
        ...(vertexIds !== undefined ? { vertexIds } : {}),
      },
    );
  }

  updateTransform(delta: TransformDelta): void {
    if (!this.gesture) {
      throw new Error("updateTransform requires beginTransform");
    }
    this.gesture.update(delta);
  }

  commitTransform(): boolean {
    if (!this.gesture) {
      return false;
    }
    const gesture = this.gesture;
    if (!gesture.hasMeaningfulChange()) {
      gesture.restoreBaseline();
      this.gesture = null;
      return false;
    }
    const snapshot = gesture.snapshot();
    gesture.commit();
    this.gesture = null;
    this.execute(
      new SetTransformsCommand({
        objects: snapshot.objects.filter(
          (patch) => !transformsNearlyEqual(patch.before, patch.after),
        ),
        vertices: snapshot.vertices.filter(
          (patch) =>
            patch.before[0] !== patch.after[0] ||
            patch.before[1] !== patch.after[1] ||
            patch.before[2] !== patch.after[2],
        ),
      }),
    );
    return true;
  }

  cancelTransform(): void {
    if (!this.gesture) {
      return;
    }
    this.gesture.restoreBaseline();
    this.gesture = null;
  }

  get isTransforming(): boolean {
    return this.gesture !== null;
  }

  beginPaintStroke(textureId: TextureId): void {
    if (this.paintStroke) {
      throw new Error("A paint stroke is already active; commit or cancel it first");
    }
    const buffer = this.textures.get(textureId);
    if (!buffer) {
      throw new RangeError(`beginPaintStroke: missing texture ${textureId}`);
    }
    const engine = new PaintEngine(buffer, this.ids.stroke());
    engine.begin();
    this.paintStroke = { textureId, engine };
  }

  dabPaintStroke(x: number, y: number, options: BrushOptions): void {
    if (!this.paintStroke) {
      throw new Error("dabPaintStroke requires beginPaintStroke");
    }
    this.paintStroke.engine.dab(x, y, options);
  }

  strokePaintTo(x0: number, y0: number, x1: number, y1: number, options: BrushOptions): void {
    if (!this.paintStroke) {
      throw new Error("strokePaintTo requires beginPaintStroke");
    }
    this.paintStroke.engine.strokeTo(x0, y0, x1, y1, options);
  }

  commitPaintStroke(): boolean {
    if (!this.paintStroke) {
      return false;
    }
    const { textureId, engine } = this.paintStroke;
    this.paintStroke = null;
    const { patches, unchanged } = engine.commit();
    engine.dispose();
    if (unchanged) {
      return false;
    }
    this.execute(new PaintStrokeCommand({ textureId, patches }));
    return true;
  }

  cancelPaintStroke(): void {
    if (!this.paintStroke) {
      return;
    }
    const { textureId, engine } = this.paintStroke;
    engine.cancel();
    engine.dispose();
    this.paintStroke = null;
    this.events.emit("document:changed", { aspect: "texture", entityIds: [textureId] });
  }

  get isPainting(): boolean {
    return this.paintStroke !== null;
  }

  diagnostics(): SDKResourceDiagnostics {
    return {
      ...emptyResourceDiagnostics(),
      subscriptions: this.events.totalListenerCount(),
      runtimeGeometries: this.meshes.size,
      runtimeTextures: this.textures.size,
      activePaintStrokes: this.paintStroke ? 1 : 0,
      activeTransactions: this.history.transactionDepth,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.cancelTransform();
    this.cancelPaintStroke();
    this.selection.dispose();
    this.history.dispose();
    this.events.clear();
    this.disposed = true;
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("ModelingSession is disposed");
    }
  }

  private meshIdForObject(
    objectId: (typeof this.selection.objectIds)[number] | undefined,
  ): MeshId | undefined {
    if (!objectId) {
      return undefined;
    }
    const payload = this.document.scene.nodes.get(objectId)?.payloadRef;
    return payload ? (payload as MeshId) : undefined;
  }

  applyClip(clip: AnimationClipData, time: number, skeletonId?: SkeletonId): void {
    const skeletonData = skeletonId
      ? this.document.skeletons.get(skeletonId)
      : [...this.document.skeletons.values()][0];
    const skeleton = skeletonData ? skeletonFromData(skeletonData) : undefined;
    const evaluated = evaluateDocumentClip(clip, time, skeleton);
    this.animationTime = evaluated.time;
    this.poseLocals = new Map(evaluated.boneLocals);
    this.objectPoseLocals = new Map(evaluated.objectLocals);
    this.events.emit("animation:time-changed", { time: evaluated.time, playing: false });
    this.events.emit("mesh:changed", { meshIds: [...this.meshes.keys()] });
  }

  saveNativeJson(): string {
    this.flushMeshes();
    this.flushTextures();
    return serializeDocument(this.document);
  }

  /** Clears all scene nodes, meshes, textures, and selection in the current session. */
  clearScene(): void {
    if (this.gesture) {
      this.cancelTransform();
    }
    if (this.paintStroke) {
      this.cancelPaintStroke();
    }
    this.selection.clear();
    clearSceneChildren(this.document);
    this.meshes.clear();
    this.document.meshes.clear();
    this.textures.clear();
    this.document.textures.clear();
    this.history.clear();
    this.events.emit("document:changed", { aspect: "scene" });
    this.events.emit("mesh:changed", { meshIds: [] });
  }

  static loadNativeJson(json: string, ids?: IdFactory): ModelingSession {
    return new ModelingSession({ document: parseDocument(json), ids });
  }

  private context(): CommandContext {
    return {
      document: this.document,
      ids: this.ids,
      selection: this.selection,
      meshes: this.meshes,
      textures: this.textures,
      events: this.events,
      syncMesh: (meshId) => this.syncMesh(meshId),
    };
  }

  private hydrateTextures(): void {
    for (const record of this.document.textures.values()) {
      const width = record.width ?? 1;
      const height = record.height ?? 1;
      if (record.pixelsBase64) {
        const bytes = base64ToBytes(record.pixelsBase64);
        const data = new Uint8ClampedArray(bytes);
        this.textures.set(record.id, new TextureBuffer(width, height, data));
      } else {
        this.textures.set(record.id, TextureBuffer.create(width, height));
      }
    }
  }

  private flushTextures(): void {
    for (const [id, buffer] of this.textures) {
      const record = this.document.textures.get(id);
      if (!record) {
        continue;
      }
      this.document.textures.set({
        ...record,
        width: buffer.width,
        height: buffer.height,
        pixelsBase64: bytesToBase64(new Uint8Array(buffer.data)),
      });
    }
  }

  private hydrateMeshes(): void {
    for (const record of this.document.meshes.values()) {
      if (record.kernel && isSerializedMesh(record.kernel)) {
        this.meshes.set(record.id, deserializeMesh(record.kernel));
      }
    }
  }

  private flushMeshes(): void {
    for (const [id, mesh] of this.meshes) {
      const record = this.document.meshes.get(id);
      if (record) {
        this.document.meshes.set({ ...record, kernel: serializeMesh(mesh) });
      }
    }
  }

  private syncMesh(meshId: MeshId): void {
    const mesh = this.meshes.get(meshId);
    const record = this.document.meshes.get(meshId);
    if (mesh && record) {
      this.document.meshes.set({ ...record, kernel: serializeMesh(mesh) });
    }
  }
}

export function createModelingSession(ids?: IdFactory): ModelingSession {
  return new ModelingSession({ ids });
}

function isSerializedMesh(value: unknown): value is SerializedMesh {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<SerializedMesh>;
  return (
    typeof record.id === "string" && Array.isArray(record.vertices) && Array.isArray(record.faces)
  );
}
