import type { MeshId, ObjectId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import type {
  PointPickRequest,
  PointPickResult,
  PointPickSource,
  VisibilityPickingAdapter,
} from "@modeling-kit/selection";
import { Group, Object3D, Raycaster, Vector2, type Camera, type Scene } from "three";
import {
  MeshVisualDirtyFlag,
  MeshVisualScheduler,
  PickRequestGate,
  ViewportHoverStore,
  SubElementVisualizer,
  MeshVisualLifecycleMachine,
  type DeepPartial,
  type OverlayMeshSource,
  type SubElementDiagnostics,
  type SubElementDisplayOptions,
  type SubElementHover,
  type SubElementVisualTheme,
} from "./sub-element";
import type { PickResult, PickingOptions } from "./picking";
import { pickWithCpuRaycaster } from "./cpu-pick";
import { pickPointHybrid, type PickFailureReason } from "./hybrid-pick";
import { collectPickDrawables } from "./pick-drawables";
import { refineGpuFaceHit } from "./canonical-face-refinement";
import { clientToNdc } from "./pick-selection";
import {
  type SharedGeometry,
  type ThreeViewportAdapterOptions,
  type TrackedObject,
  type ViewportRenderer,
} from "./adapter-types";
import { asWebGLRenderer, DefaultGpuPickingService, type GpuPickingReadback } from "./gpu-picking";
import { SceneDirtyFlag, type SceneMirrorLifecycle } from "./scene-sync";
import { createBvhSpatialQuery, syncSpatialQuery, type SpatialQueryBackend } from "./spatial-query";
import { clearLegacyOverlay, syncOverlays, type OverlaySyncContext } from "./adapter-overlay";
import {
  applyTrackedNames,
  applyTrackedTransforms,
  applyTrackedVisibility,
  disposeTracked,
  rebuildSceneGraph,
  syncMaterialsOnly,
  syncMeshesById,
  type SceneMirrorContext,
} from "./adapter-scene-sync";
import { bindAdapterSessionEvents } from "./adapter-session-events";

export type { SharedGeometry, ThreeViewportAdapterOptions, TrackedObject, ViewportRenderer } from "./adapter-types";

export class ThreeViewportAdapter implements VisibilityPickingAdapter {
  readonly root = new Group();
  private readonly session: ModelingSession;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly renderer: ViewportRenderer;
  private readonly textureResolver: ThreeViewportAdapterOptions["textureResolver"];
  private readonly tracked = new Map<ObjectId, TrackedObject>();
  private readonly geometries = new Map<MeshId, SharedGeometry>();
  readonly lifecycle = new MeshVisualLifecycleMachine();
  private readonly overlay = new Group();
  private readonly overlayObjects: Object3D[] = [];
  private readonly visualizer = new SubElementVisualizer();
  private readonly overlaySources: OverlayMeshSource[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  readonly viewportId: string;
  readonly pickGate = new PickRequestGate();
  readonly hoverStore = new ViewportHoverStore();
  readonly scheduler: MeshVisualScheduler;
  private mounted = false;
  private disposed = false;
  private autoFlush: boolean;
  pendingFlags = SceneDirtyFlag.None;
  flushCount = 0;
  private jobGeneration = 0;
  private syncing = false;
  private inViewFrame = false;
  private frameId = 0;
  private viewport = { width: 800, height: 600, pixelRatio: 1 };
  private readonly raycaster = new Raycaster();
  private spatialQuery: SpatialQueryBackend | undefined;
  private ownsSpatialQuery: boolean;
  private readonly gpuPickingMode: GpuPickingReadback | "off";
  private readonly gpuPicking: DefaultGpuPickingService | undefined;
  lastPickSource: PointPickSource | "unavailable" = "cpu-raycast";
  lastPickFailure: PickFailureReason | undefined;
  private sceneGeneration = 0;

  constructor(options: ThreeViewportAdapterOptions) {
    this.session = options.session;
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.textureResolver = options.textureResolver;
    this.viewportId = options.viewportId ?? "viewport-default";
    this.autoFlush = options.autoFlush !== false;
    if (options.spatialQuery) {
      this.spatialQuery = options.spatialQuery;
      this.ownsSpatialQuery = options.ownsSpatialQuery === true;
    } else if (options.spatialAcceleration !== false) {
      this.spatialQuery = createBvhSpatialQuery();
      this.ownsSpatialQuery = true;
    } else {
      this.spatialQuery = undefined;
      this.ownsSpatialQuery = false;
    }
    const webgl = asWebGLRenderer(this.renderer);
    this.gpuPickingMode = options.gpuPicking ?? "webgl";
    this.gpuPicking =
      this.gpuPickingMode === "off"
        ? undefined
        : new DefaultGpuPickingService({
            camera: this.camera,
            getDrawables: () => collectPickDrawables(this.tracked, this.session, this.camera, this.root),
            ...(this.gpuPickingMode === "software"
              ? { readback: "software" as const }
              : webgl
                ? { renderer: webgl, readback: "webgl" as const }
                : { readback: "webgl" as const }),
          });
    this.scheduler = new MeshVisualScheduler({
      flushMesh: (_meshId, flags) => {
        if (this.disposed) {
          return;
        }
        const rebuild =
          (flags & MeshVisualDirtyFlag.Topology) !== 0 ||
          (flags & MeshVisualDirtyFlag.Positions) !== 0 ||
          (flags & MeshVisualDirtyFlag.Theme) !== 0;
        const state =
          (flags & MeshVisualDirtyFlag.VertexStates) !== 0 ||
          (flags & MeshVisualDirtyFlag.EdgeStates) !== 0 ||
          (flags & MeshVisualDirtyFlag.FaceStates) !== 0;
        this.syncOverlays(rebuild ? "full" : state ? "state" : "view");
      },
    });
    this.root.name = "modeling-kit-root";
    this.overlay.name = "modeling-kit-overlay";
    this.overlay.userData.isOverlay = true;
    this.root.add(this.overlay);
    if (options.subElement?.theme) {
      this.visualizer.setTheme(options.subElement.theme);
    }
    if (options.subElement?.display) {
      this.visualizer.setDisplay(options.subElement.display);
    }
  }

  mount(): void {
    this.assertAlive();
    if (this.mounted) {
      return;
    }
    this.scene.add(this.root);
    this.unsubscribers.push(
      ...bindAdapterSessionEvents(this.session, {
        scheduler: this.scheduler,
        isSyncing: () => this.syncing,
        markDirty: (flags) => this.markDirty(flags),
        syncTransforms: (objectIds) => this.syncTransforms(objectIds),
        syncVisibility: (objectIds) => this.syncVisibility(objectIds),
        syncNames: (objectIds) => this.syncNames(objectIds),
        syncMaterialsOnly: (force) => this.syncMaterialsOnly(force),
        flushOrSchedule: () => this.flushOrSchedule(),
        syncMeshesById: (meshIds) => this.syncMeshesById(meshIds),
        flushVisuals: () => this.flushVisuals(),
        sync: () => this.sync(),
      }),
    );
    this.mounted = true;
    this.lifecycle.transition("building");
    this.sync();
    this.lifecycle.transition("ready");
  }

  get runtimeGeometryCount(): number {
    return this.geometries.size;
  }

  resourceDiagnostics() {
    return {
      subscriptions: this.unsubscribers.length,
      runtimeMaterials: [...this.tracked.values()].reduce((n, tracked) => {
        if (!tracked.material) {
          return n;
        }
        return n + (Array.isArray(tracked.material) ? tracked.material.length : 1);
      }, 0),
      runtimeTextures: 0,
      runtimeGeometries: this.geometries.size,
      gpuPicking: this.gpuPicking?.diagnostics(),
      objectUrls: 0,
      workers: 0,
      scheduledJobs: this.scheduler.pendingCount,
      activePaintStrokes: this.session.isPainting ? 1 : 0,
      activeTransactions: 0,
      cachedUVTopologies: 0,
      cachedImageComposites: 0,
    };
  }

  get nodeObjects(): ReadonlyMap<ObjectId, Object3D> {
    const map = new Map<ObjectId, Object3D>();
    for (const [id, tracked] of this.tracked) {
      map.set(id, tracked.object);
    }
    return map;
  }

  get mirrorState(): SceneMirrorLifecycle {
    return this.lifecycle.state;
  }

  markDirty(flags: SceneDirtyFlag): void {
    this.pendingFlags |= flags;
  }

  flushPending(): void {
    if (this.pendingFlags === SceneDirtyFlag.None) {
      return;
    }
    this.flushCount += 1;
    const flags = this.pendingFlags;
    this.pendingFlags = SceneDirtyFlag.None;
    if (flags === SceneDirtyFlag.Transforms) {
      return;
    }
    if (flags === SceneDirtyFlag.Visibility) {
      return;
    }
    if ((flags & SceneDirtyFlag.Materials) !== 0 && (flags & ~(SceneDirtyFlag.Materials | SceneDirtyFlag.Textures)) === 0) {
      this.syncMaterialsOnly();
      return;
    }
    if (flags === SceneDirtyFlag.Textures) {
      return;
    }
    this.sync();
  }

  isCurrentJob(generation: number): boolean {
    return generation === this.jobGeneration && !this.disposed;
  }

  sync(): void {
    this.assertAlive();
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    try {
      rebuildSceneGraph(this.sceneMirror(), this.root);
      this.sceneGeneration += 1;
      this.syncSpatialIndex();
      this.syncOverlays("full");
      this.gpuPicking?.invalidate("scene");
    } finally {
      this.syncing = false;
    }
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    this.assertAlive();
    this.viewport = { width, height, pixelRatio };
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.gpuPicking?.resize(width, height);
    this.gpuPicking?.invalidate("resize");
    this.syncOverlays("view");
  }

  updateView(): void {
    this.assertAlive();
    this.inViewFrame = true;
    this.frameId += 1;
    try {
      this.scheduler.flush(this.frameId);
      this.syncOverlays("view");
    } finally {
      this.inViewFrame = false;
    }
  }

  setSubElementTheme(theme?: DeepPartial<SubElementVisualTheme>): void {
    this.assertAlive();
    this.visualizer.setTheme(theme);
    this.scheduler.invalidate("*", MeshVisualDirtyFlag.Theme);
    this.flushVisuals();
  }

  setSubElementDisplay(display?: DeepPartial<SubElementDisplayOptions>): void {
    this.assertAlive();
    this.visualizer.setDisplay(display);
    this.scheduler.invalidate(
      "*",
      MeshVisualDirtyFlag.Visibility |
        MeshVisualDirtyFlag.VertexStates |
        MeshVisualDirtyFlag.EdgeStates |
        MeshVisualDirtyFlag.FaceStates,
    );
    this.flushVisuals();
  }

  setHover(hover: SubElementHover | null, requestId?: number): void {
    this.assertAlive();
    const id = requestId ?? this.pickGate.next();
    if (hover) {
      const accepted = this.hoverStore.applyIfCurrent({
        viewportId: this.viewportId,
        domain: hover.domain,
        elementId: hover.elementId,
        requestId: id,
      });
      if (!accepted) {
        return;
      }
    } else {
      this.hoverStore.clear(this.viewportId);
    }
    if (!this.visualizer.setHover(hover)) {
      return;
    }
    this.visualizer.pruneHover();
    this.scheduler.invalidate(
      "*",
      MeshVisualDirtyFlag.VertexStates | MeshVisualDirtyFlag.EdgeStates | MeshVisualDirtyFlag.FaceStates,
    );
    this.flushVisuals();
  }

  setElementFlags(flags: Parameters<SubElementVisualizer["setElementFlags"]>[0]): void {
    this.assertAlive();
    this.visualizer.setElementFlags(flags);
    this.syncOverlays("state");
  }

  subElementPerf(): { topologyRebuilds: number; positionRefreshes: number; skippedViews: number } {
    return { ...this.visualizer.perf };
  }

  subElementGpuCounts(): { geometries: number; materials: number; textures: number; layers: number } {
    return this.visualizer.gpuCounts();
  }

  subscriberCount(): number {
    return this.unsubscribers.length;
  }

  lastPatchedIndices(): number[] {
    return this.visualizer.lastPatchedIndices;
  }

  subElementDiagnostics(): SubElementDiagnostics {
    const local = this.visualizer.diagnostics();
    return {
      ...local,
      pendingDirtyFlags: this.scheduler.pendingFlags,
      flushCount: this.scheduler.flushCount,
      activeSubscriptions: this.unsubscribers.length,
      pendingJobs: this.scheduler.pendingCount,
    };
  }

  object3D(objectId: ObjectId): Object3D | undefined {
    return this.tracked.get(objectId)?.object;
  }

  pick(ndcX: number, ndcY: number, options?: Partial<PickingOptions>): PickResult | null {
    this.assertAlive();
    return pickWithCpuRaycaster({
      disposed: this.disposed,
      pickGate: this.pickGate,
      root: this.root,
      camera: this.camera,
      raycaster: this.raycaster,
      spatialQuery: this.spatialQuery,
      visualizer: this.visualizer,
      tracked: this.tracked,
      session: this.session,
      viewport: this.viewport,
    }, ndcX, ndcY, options);
  }

  pickingRevisions(): { scene: number; camera: number } {
    return { scene: this.sceneGeneration, camera: this.cameraRevision() };
  }

  async pickPoint(request: PointPickRequest): Promise<PointPickResult | undefined> {
    this.assertAlive();
    const context = {
      gpuPickingMode: this.gpuPickingMode,
      gpuPicking: this.gpuPicking,
      renderer: this.renderer,
      viewport: this.viewport,
      lastPickSource: this.lastPickSource,
      lastPickFailure: this.lastPickFailure,
      pick: (ndcX: number, ndcY: number, options?: Partial<PickingOptions>) => this.pick(ndcX, ndcY, options),
      refineIdentity: (identity: PointPickResult, pickRequest: PointPickRequest) => {
        if (identity.kind !== "identity") {
          return undefined;
        }
        const object = this.tracked.get(identity.objectId)?.object;
        if (!object) {
          return undefined;
        }
        const viewport = pickRequest.viewport ?? {
          x: 0,
          y: 0,
          width: pickRequest.canvasRect.width,
          height: pickRequest.canvasRect.height,
        };
        const ndcRect = {
          left: pickRequest.canvasRect.left + viewport.x,
          top: pickRequest.canvasRect.top + viewport.y,
          width: viewport.width,
          height: viewport.height,
        };
        const ndc = clientToNdc(pickRequest.clientX, pickRequest.clientY, ndcRect);
        this.raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), this.camera);
        const origin = this.raycaster.ray.origin;
        const direction = this.raycaster.ray.direction;
        const outcome = refineGpuFaceHit({
          session: this.session,
          object,
          objectId: identity.objectId,
          ...(identity.meshId ? { meshId: identity.meshId } : {}),
          ...(identity.faceId ? { faceId: identity.faceId } : {}),
          worldRayOrigin: { x: origin.x, y: origin.y, z: origin.z },
          worldRayDirection: { x: direction.x, y: direction.y, z: direction.z },
          backfaceMode: pickRequest.backfaceMode ?? (pickRequest.domain === "object" ? "front-and-back" : "front-only"),
          domain: pickRequest.domain === "object" ? "object" : "face",
        });
        return outcome.ok ? outcome.hit : undefined;
      },
    };
    const result = await pickPointHybrid(context, request);
    this.lastPickSource = context.lastPickSource;
    this.lastPickFailure = context.lastPickFailure;
    return result;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    for (const off of this.unsubscribers) {
      off();
    }
    this.unsubscribers.length = 0;
    for (const tracked of this.tracked.values()) {
      disposeTracked(this.sceneMirror(), tracked);
    }
    this.tracked.clear();
    clearLegacyOverlay(this.overlayContext());
    this.scheduler.dispose();
    this.visualizer.dispose();
    this.scene.remove(this.root);
    this.jobGeneration += 1;
    this.pickGate.invalidate();
    this.hoverStore.dispose();
    this.lifecycle.dispose();
    this.gpuPicking?.dispose();
    if (this.ownsSpatialQuery) {
      this.spatialQuery?.dispose();
    }
    this.spatialQuery = undefined;
    this.mounted = false;
    this.disposed = true;
  }

  setSpatialQuery(backend: SpatialQueryBackend | undefined, owns = false): void {
    this.assertAlive();
    if (this.spatialQuery === backend) {
      this.ownsSpatialQuery = owns;
      return;
    }
    if (this.ownsSpatialQuery) {
      this.spatialQuery?.dispose();
    }
    this.spatialQuery = backend;
    this.ownsSpatialQuery = owns;
    this.syncSpatialIndex();
  }

  private sceneMirror(): SceneMirrorContext {
    return {
      session: this.session,
      tracked: this.tracked,
      geometries: this.geometries,
      ...(this.textureResolver ? { textureResolver: this.textureResolver } : {}),
    };
  }

  private overlayContext(): OverlaySyncContext {
    return {
      overlaySources: this.overlaySources,
      overlayObjects: this.overlayObjects,
      tracked: this.tracked,
      session: this.session,
      visualizer: this.visualizer,
      camera: this.camera,
      viewport: this.viewport,
    };
  }

  private flushOrSchedule(): void {
    if (this.autoFlush) {
      this.flushPending();
    }
  }

  private syncTransforms(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    if (applyTrackedTransforms(this.sceneMirror(), objectIds) === "rebuild") {
      this.sync();
      return;
    }
    this.syncSpatialIndex();
    this.gpuPicking?.invalidate("transform");
    this.syncOverlays("view");
  }

  private syncVisibility(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    if (applyTrackedVisibility(this.sceneMirror(), objectIds) === "rebuild") {
      this.sync();
      return;
    }
    this.syncSpatialIndex();
    this.gpuPicking?.invalidate("visibility");
    this.sceneGeneration += 1;
  }

  private syncNames(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    applyTrackedNames(this.sceneMirror(), objectIds);
  }

  private syncMaterialsOnly(force = false): void {
    this.assertAlive();
    syncMaterialsOnly(this.sceneMirror(), force);
  }

  private syncMeshesById(meshIds: readonly string[]): void {
    syncMeshesById(this.sceneMirror(), meshIds);
    this.sceneGeneration += 1;
    this.syncSpatialIndex();
    this.gpuPicking?.invalidate("geometry");
  }

  private syncSpatialIndex(): void {
    syncSpatialQuery(this.spatialQuery, this.tracked);
  }

  private flushVisuals(): void {
    if (this.inViewFrame) {
      return;
    }
    this.scheduler.flushNow();
  }

  private syncOverlays(mode: "full" | "state" | "view" = "full"): void {
    this.assertAlive();
    syncOverlays(this.overlayContext(), mode);
  }

  private cameraRevision(): number {
    const elements = this.camera.matrixWorld.elements;
    const projection = this.camera.projectionMatrix.elements;
    let hash = (this.viewport.width * 397) ^ this.viewport.height ^ (this.viewport.pixelRatio * 1000);
    for (let i = 0; i < 16; i += 1) {
      hash = (hash * 31 + Math.round((elements[i] ?? 0) * 1e4)) | 0;
      hash = (hash * 31 + Math.round((projection[i] ?? 0) * 1e4)) | 0;
    }
    return hash;
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error("ThreeViewportAdapter has been disposed");
    }
  }
}

export type { PickDomain, PickResult, PickingOptions } from "./picking";
