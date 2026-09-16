import {
  brand,
  type EdgeId,
  type FaceId,
  type MaterialId,
  type MaterialSlotId,
  type MeshId,
  type ObjectId,
  type VertexId,
} from "@modeling-kit/core";
import type { MaterialData } from "@modeling-kit/document";
import type { MaterialSlotTarget } from "@modeling-kit/materials";
import { cloneTransform } from "@modeling-kit/transform";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { PrimitiveFaceGroups, PrimitiveType } from "@modeling-kit/primitives";
import { CreatePrimitiveCommand, type CreatePrimitiveParams } from "./create-primitive";
import { ExtrudeFacesCommand, type ExtrudeFacesParams } from "./extrude-faces";
import { InsetFacesCommand, type InsetFacesParams } from "./inset-faces";
import { BevelEdgesCommand, type BevelEdgesParams } from "./bevel-edges";
import { SplitEdgeCommand, CutFaceCommand, type CutFaceParams } from "./split-cut";
import { SubdivideFacesCommand } from "./subdivide-faces";
import { CatmullClarkSubdivideCommand } from "./catmull-clark";
import { LoopCutCommand, type LoopCutParams } from "./loop-cut";
import { DissolveEdgesCommand } from "./dissolve-edges";
import { FillBoundaryCommand } from "./fill-boundary";
import { KnifeCutCommand } from "./knife";
import { HealMeshCommand } from "./heal-mesh";
import { WeldVerticesCommand } from "./weld-vertices";
import { MergeVerticesCommand } from "./merge-vertices";
import { TriangulateFacesCommand } from "./triangulate-faces";
import { ConnectVerticesCommand } from "./connect-vertices";
import { BridgeLoopsCommand, type BridgeLoopsParams } from "./bridge-loops";
import type { Vec3Tuple, MergeVertexTarget } from "@modeling-kit/mesh";
import { SetTransformsCommand } from "./set-transforms";
import { SetVisibilityCommand } from "./set-visibility";
import { inspectScene, type SceneInspectionResult } from "./scene-inspector";
import { createModelingSession, ModelingSession } from "./session";
import { parseFaceGroups, type SemanticFaceTag } from "./face-groups";
import { CreateMaterialCommand, type CreateMaterialParams } from "./create-material";
import { UpdateMaterialCommand } from "./update-material";
import { AssignMaterialSlotCommand } from "./assign-material-slot";
import { AddMaterialSlotCommand, ReorderMaterialSlotsCommand } from "./material-slot-commands";

export type VecDelta = { readonly x?: number; readonly y?: number; readonly z?: number };

export type FaceSelectFilter = SemanticFaceTag | readonly FaceId[];

/** Fluent object proxy allowing method chaining on a 3D object and its topology. */
export class FluentMeshObject {
  constructor(
    readonly editor: FluentEditor,
    readonly objectId: ObjectId,
    readonly meshId: MeshId,
    readonly groups?: PrimitiveFaceGroups | undefined,
  ) {}

  get mesh(): HalfEdgeMesh | undefined {
    return this.editor.session.meshes.get(this.meshId);
  }

  private resolveGroups(): PrimitiveFaceGroups | undefined {
    if (this.groups) {
      return this.groups;
    }
    const record = this.editor.session.document.meshes.get(this.meshId);
    return record ? parseFaceGroups(record.metadata) : undefined;
  }

  /** Selects the object itself. */
  selectObject(): this {
    this.editor.session.selection.replace({
      domain: "object",
      objectIds: [this.objectId],
      elementIds: [],
    });
    return this;
  }

  /** Selects faces by semantic group name or specific face IDs. */
  select(filter: FaceSelectFilter): this {
    return this.selectFaces(filter);
  }

  selectFaces(filter: FaceSelectFilter): this {
    const mesh = this.mesh;
    if (!mesh) {
      return this;
    }

    const groups = this.resolveGroups();
    let faceIds: FaceId[] = [];
    if (filter === "all") {
      faceIds = Array.from(mesh.faces.keys());
    } else if (filter === "left" && groups?.negX) {
      faceIds = [groups.negX];
    } else if (filter === "right" && groups?.posX) {
      faceIds = [groups.posX];
    } else if (typeof filter === "string") {
      const tagged = groups?.[filter as Exclude<SemanticFaceTag, "all" | "left" | "right">];
      faceIds = tagged ? [...tagged] : [];
    } else {
      faceIds = [...filter];
    }

    this.editor.session.selection.replace({
      domain: "face",
      objectId: this.objectId,
      elementIds: faceIds,
    });
    return this;
  }

  selectEdges(filter: "all" | readonly EdgeId[]): this {
    const mesh = this.mesh;
    if (!mesh) {
      return this;
    }
    const edgeIds: EdgeId[] = filter === "all" ? Array.from(mesh.edges.keys()) : [...filter];
    this.editor.session.selection.replace({
      domain: "edge",
      objectId: this.objectId,
      elementIds: edgeIds,
    });
    return this;
  }

  selectVertices(filter: "all" | readonly VertexId[]): this {
    const mesh = this.mesh;
    if (!mesh) {
      return this;
    }
    const vertexIds: VertexId[] = filter === "all" ? Array.from(mesh.vertices.keys()) : [...filter];
    this.editor.session.selection.replace({
      domain: "vertex",
      objectId: this.objectId,
      elementIds: vertexIds,
    });
    return this;
  }

  extrude(distance = 0.5, options: Omit<ExtrudeFacesParams, "distance"> = {}): this {
    this.editor.session.execute(new ExtrudeFacesCommand({ distance, ...options }));
    return this;
  }

  inset(distance = 0.2, options: Omit<InsetFacesParams, "distance"> = {}): this {
    this.editor.session.execute(new InsetFacesCommand({ distance, ...options }));
    return this;
  }

  bevel(offset = 0.1, options: Omit<BevelEdgesParams, "offset"> = {}): this {
    this.editor.session.execute(new BevelEdgesCommand({ offset, ...options }));
    return this;
  }

  splitEdge(t = 0.5): this {
    this.editor.session.execute(new SplitEdgeCommand({ t }));
    return this;
  }

  cutFace(from: CutFaceParams["from"], to: CutFaceParams["to"]): this {
    this.editor.session.execute(new CutFaceCommand({ from, to }));
    return this;
  }

  subdivide(iterations = 1): this {
    const count = Math.max(1, Math.floor(iterations));
    for (let i = 0; i < count; i += 1) {
      this.editor.session.execute(new SubdivideFacesCommand());
    }
    return this;
  }

  catmullClark(iterations = 1): this {
    this.editor.session.execute(new CatmullClarkSubdivideCommand({ iterations }));
    return this;
  }

  loopCut(factor = 0.5, options: Omit<LoopCutParams, "factor"> = {}): this {
    this.editor.session.execute(new LoopCutCommand({ factor, ...options }));
    return this;
  }

  dissolve(): this {
    this.editor.session.execute(new DissolveEdgesCommand());
    return this;
  }

  fillHole(method: "ngon" | "fan" | "triangulate" = "ngon"): this {
    this.editor.session.execute(new FillBoundaryCommand({ method }));
    return this;
  }

  knife(points: readonly Vec3Tuple[], snapRadius?: number): this {
    this.editor.session.execute(
      new KnifeCutCommand(snapRadius === undefined ? { points } : { points, snapRadius }),
    );
    return this;
  }

  heal(): this {
    this.editor.session.execute(new HealMeshCommand());
    return this;
  }

  weld(epsilon = 1e-6): this {
    this.editor.session.execute(new WeldVerticesCommand({ epsilon }));
    return this;
  }

  triangulate(): this {
    this.editor.session.execute(new TriangulateFacesCommand());
    return this;
  }

  mergeVertices(target: MergeVertexTarget = "center"): this {
    this.editor.session.execute(new MergeVerticesCommand({ target }));
    return this;
  }

  connectVertices(): this {
    this.editor.session.execute(new ConnectVerticesCommand());
    return this;
  }

  bridge(loopA: BridgeLoopsParams["loopA"], loopB: BridgeLoopsParams["loopB"], reverseB = false): this {
    this.editor.session.execute(
      new BridgeLoopsCommand({
        loopA,
        loopB,
        ...(reverseB ? { reverseB: true } : {}),
      }),
    );
    return this;
  }

  nudge(delta: VecDelta): this {
    return this.move(delta);
  }

  hide(): this {
    this.editor.session.execute(new SetVisibilityCommand({ visible: false, objectId: this.objectId }));
    return this;
  }

  /** Translates the selected components, or the whole object if the domain is object. */
  move(delta: VecDelta): this {
    const dx = delta.x ?? 0;
    const dy = delta.y ?? 0;
    const dz = delta.z ?? 0;
    const sel = this.editor.session.selection;
    const mesh = this.mesh;
    const node = this.editor.session.document.scene.nodes.get(this.objectId);

    if (!node) {
      return this;
    }

    if (sel.domain === "object" || !mesh || sel.elementIds.length === 0) {
      const before = cloneTransform(node.localTransform);
      const after = {
        position: {
          x: before.position.x + dx,
          y: before.position.y + dy,
          z: before.position.z + dz,
        },
        rotation: { ...before.rotation },
        scale: { ...before.scale },
      };
      this.editor.session.execute(
        new SetTransformsCommand({
          objects: [{ objectId: this.objectId, before, after }],
        }),
      );
      return this;
    }

    const affected = new Set<VertexId>();
    if (sel.domain === "vertex") {
      for (const id of sel.elementIds) {
        affected.add(id as VertexId);
      }
    } else if (sel.domain === "edge") {
      for (const eId of sel.elementIds) {
        const pair = mesh.getEdgeVertices(eId as EdgeId);
        if (pair) {
          affected.add(pair[0]);
          affected.add(pair[1]);
        }
      }
    } else if (sel.domain === "face") {
      for (const fId of sel.elementIds) {
        for (const v of mesh.getFaceVertices(fId as FaceId)) {
          affected.add(v);
        }
      }
    }

    const patches = [];
    for (const vId of affected) {
      const v = mesh.vertices.get(vId);
      if (v) {
        patches.push({
          meshId: this.meshId,
          vertexId: vId,
          before: [v.position[0], v.position[1], v.position[2]] as [number, number, number],
          after: [v.position[0] + dx, v.position[1] + dy, v.position[2] + dz] as [number, number, number],
        });
      }
    }

    if (patches.length > 0) {
      this.editor.session.execute(new SetTransformsCommand({ vertices: patches }));
    }
    return this;
  }

  addMaterialSlot(target: MaterialSlotTarget, name?: string, slotId?: MaterialSlotId): MaterialSlotId {
    return this.editor.session.execute(
      new AddMaterialSlotCommand({
        meshId: this.meshId,
        slotId,
        name,
        target,
      }),
    );
  }

  assignMaterialSlot(slotIdOrIndex: MaterialSlotId | number, faceIds?: readonly FaceId[]): this {
    if (typeof slotIdOrIndex === "number") {
      this.editor.session.execute(
        new AssignMaterialSlotCommand({
          meshId: this.meshId,
          slotIndex: slotIdOrIndex,
          faceIds,
        }),
      );
    } else {
      this.editor.session.execute(
        new AssignMaterialSlotCommand({
          meshId: this.meshId,
          slotId: slotIdOrIndex,
          faceIds,
        }),
      );
    }
    return this;
  }

  reorderMaterialSlots(orderedSlotIds: readonly MaterialSlotId[]): this {
    this.editor.session.execute(
      new ReorderMaterialSlotsCommand({
        meshId: this.meshId,
        orderedSlotIds,
      }),
    );
    return this;
  }
}

export class FluentSelection {
  constructor(private readonly editor: FluentEditor) {}

  move(delta: VecDelta): FluentEditor {
    this.editor.activeObject()?.move(delta);
    return this.editor;
  }

  nudge(delta: VecDelta): FluentEditor {
    return this.move(delta);
  }
}

/** High-level fluent editor API wrapping ModelingSession with chainable ergonomics. */
export class FluentEditor {
  readonly session: ModelingSession;
  private lastObject: FluentMeshObject | null = null;
  private readonly ownsSession: boolean;
  private disposed = false;

  constructor(session?: ModelingSession) {
    this.ownsSession = session === undefined;
    this.session = session ?? createModelingSession();
  }

  get selection(): FluentSelection {
    return new FluentSelection(this);
  }

  /**
   * Releases session resources when this editor created the session.
   * Hosts that passed an existing `ModelingSession` still own that session.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.lastObject = null;
    if (this.ownsSession) {
      this.session.dispose();
    }
  }

  activeObject(): FluentMeshObject | undefined {
    const selectedId = this.session.selection.objectIds[0];
    if (selectedId && this.lastObject?.objectId === selectedId) {
      return this.lastObject;
    }
    if (selectedId) {
      const wrapped = wrapObject(this, selectedId);
      if (wrapped) {
        return wrapped;
      }
    }
    return this.lastObject ?? undefined;
  }

  readonly spawn = {
    primitive: (type: PrimitiveType, params: CreatePrimitiveParams = {}): FluentMeshObject => {
      const res = this.session.execute(new CreatePrimitiveCommand(type, params));
      const object = new FluentMeshObject(this, res.objectId, res.meshId, res.groups);
      this.lastObject = object;
      object.selectObject();
      return object;
    },
    box: (params: { size?: number; width?: number; height?: number; depth?: number; name?: string } = {}): FluentMeshObject => {
      return this.spawn.cube(params);
    },
    cube: (params: { size?: number; width?: number; height?: number; depth?: number; name?: string } = {}): FluentMeshObject => {
      const w = params.width ?? params.size ?? 2;
      const h = params.height ?? params.size ?? 2;
      const d = params.depth ?? params.size ?? 2;
      return this.spawn.primitive("cube", {
        width: w,
        height: h,
        depth: d,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    plane: (
      params: { width?: number; depth?: number; height?: number; name?: string } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("plane", {
        width: params.width ?? 2,
        depth: params.depth ?? params.height ?? 2,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    cylinder: (
      params: { radius?: number; height?: number; segments?: number; name?: string } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("cylinder", {
        radius: params.radius ?? 1,
        height: params.height ?? 2,
        segments: params.segments ?? 16,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    sphere: (
      params: { radius?: number; segments?: number; rings?: number; name?: string } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("uvSphere", {
        radius: params.radius ?? 1,
        widthSegments: params.segments ?? 16,
        heightSegments: params.rings ?? 12,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    uvSphere: (
      params: { radius?: number; widthSegments?: number; heightSegments?: number; name?: string } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("uvSphere", {
        ...(params.radius !== undefined ? { radius: params.radius } : {}),
        ...(params.widthSegments !== undefined ? { widthSegments: params.widthSegments } : {}),
        ...(params.heightSegments !== undefined ? { heightSegments: params.heightSegments } : {}),
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    cone: (params: { radius?: number; height?: number; segments?: number; name?: string } = {}): FluentMeshObject => {
      return this.spawn.primitive("cone", {
        radius: params.radius ?? 1,
        height: params.height ?? 2,
        segments: params.segments ?? 16,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    torus: (
      params: {
        radius?: number;
        tube?: number;
        tubeRadius?: number;
        radialSegments?: number;
        tubularSegments?: number;
        name?: string;
      } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("torus", {
        radius: params.radius ?? 1,
        tube: params.tube ?? params.tubeRadius ?? 0.3,
        radialSegments: params.radialSegments ?? 12,
        tubularSegments: params.tubularSegments ?? 24,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    pyramid: (
      params: { width?: number; depth?: number; height?: number; size?: number; name?: string } = {},
    ): FluentMeshObject => {
      const width = params.width ?? params.size ?? 2;
      const depth = params.depth ?? params.size ?? 2;
      return this.spawn.primitive("pyramid", {
        width,
        depth,
        height: params.height ?? 2,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    icosphere: (
      params: { radius?: number; subdivisions?: number; name?: string } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("icosphere", {
        radius: params.radius ?? 1,
        subdivisions: params.subdivisions ?? 1,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
    capsule: (
      params: {
        radius?: number;
        height?: number;
        segments?: number;
        capSegments?: number;
        name?: string;
      } = {},
    ): FluentMeshObject => {
      return this.spawn.primitive("capsule", {
        radius: params.radius ?? 0.5,
        height: params.height ?? 1,
        segments: params.segments ?? 16,
        capSegments: params.capSegments ?? 8,
        ...(params.name !== undefined ? { name: params.name } : {}),
      });
    },
  };

  readonly select = {
    tagged: (tag: SemanticFaceTag): FluentMeshObject | undefined => this.activeObject()?.select(tag),
    all: (): FluentMeshObject | undefined => this.activeObject()?.select("all"),
    face: (ids: readonly FaceId[]): FluentMeshObject | undefined => this.activeObject()?.selectFaces(ids),
  };

  inspect(): SceneInspectionResult {
    return inspectScene(this.session);
  }

  clear(): this {
    this.session.clearScene();
    this.lastObject = null;
    return this;
  }

  undo(): this {
    this.session.undo();
    return this;
  }

  redo(): this {
    this.session.redo();
    return this;
  }

  get canUndo(): boolean {
    return this.session.history.canUndo;
  }

  get canRedo(): boolean {
    return this.session.history.canRedo;
  }

  createPbrMaterial(params: CreateMaterialParams = {}): MaterialId {
    return this.session.execute(new CreateMaterialCommand({ ...params, type: "standard-pbr" }));
  }

  createUnlitMaterial(params: CreateMaterialParams = {}): MaterialId {
    return this.session.execute(new CreateMaterialCommand({ ...params, type: "unlit" }));
  }

  updateMaterial(materialId: MaterialId, patch: Partial<Omit<MaterialData, "id">>): this {
    this.session.execute(new UpdateMaterialCommand({ materialId, patch }));
    return this;
  }
}

export function createEditor(session?: ModelingSession): FluentEditor {
  return new FluentEditor(session);
}

function wrapObject(editor: FluentEditor, objectId: ObjectId): FluentMeshObject | undefined {
  const node = editor.session.document.scene.nodes.get(objectId);
  if (!node?.payloadRef) {
    return undefined;
  }
  const meshId = brand<string, "MeshId">(node.payloadRef);
  const record = editor.session.document.meshes.get(meshId);
  return new FluentMeshObject(editor, objectId, meshId, record ? parseFaceGroups(record.metadata) : undefined);
}
