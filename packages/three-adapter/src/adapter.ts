import { brand, type EdgeId, type MeshId, type ObjectId, type VertexId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import { getEffectiveVisibility, isMeshLikeNode, type SceneNode } from "@modeling-kit/document";
import {
  BufferGeometry,
  Group,
  Mesh,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Material,
  type Scene,
} from "three";
import { syncDerivedGeometry, type RenderMapping } from "./geometry";
import { applyFaceMaterialGroups, disposeMaterials, materialsForRecord } from "./pbr";
import { applyCpuSkin } from "./skin";
import { buildSelectionOverlay, disposeOverlayObject } from "./overlay";
import {
  MeshVisualDirtyFlag,
  MeshVisualScheduler,
  PickRequestGate,
  ViewportHoverStore,
  SubElementVisualizer,
  MeshVisualLifecycleMachine,
  type DeepPartial,
  type OverlayMeshSource,
  type SubElementDisplayOptions,
  type SubElementHover,
  type SubElementVisualTheme,
} from "./sub-element";
import type { SubElementDiagnostics } from "./sub-element/diagnostics";
import {
  pickEdgeOnFace,
  pickVertexOnFace,
  resolveFaceId,
  type PickDomain,
  type PickResult,
  type PickingOptions,
} from "./picking";
import { SceneDirtyFlag, type SceneMirrorLifecycle } from "./scene-sync";
import type { SpatialQueryBackend } from "./spatial-query";

export interface ViewportRenderer {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
}

export interface ThreeViewportAdapterOptions {
  readonly session: ModelingSession;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: ViewportRenderer;
  readonly viewportId?: string;
  readonly autoFlush?: boolean;
  /** Optional object-level accelerator. Canonical picking remains CPU `Raycaster`. */
  readonly spatialQuery?: SpatialQueryBackend;
  /** When true, `dispose()` also disposes the provided spatial backend. Default false. */
  readonly ownsSpatialQuery?: boolean;
  readonly subElement?: {
    readonly theme?: DeepPartial<SubElementVisualTheme>;
    readonly display?: DeepPartial<SubElementDisplayOptions>;
  };
}

interface TrackedObject {
  object: Object3D;
  geometry?: BufferGeometry;
  material?: Material | Material[];
  mapping?: RenderMapping;
  meshRevision?: number;
  materialKey?: string;
  poseKey?: string;
}

interface SharedGeometry {
  geometry: BufferGeometry;
  mapping: RenderMapping;
  revision: number;
  topologyRevision: number;
  uvRevision: number;
  refs: number;
}

export class ThreeViewportAdapter {
  readonly root = new Group();
  private readonly session: ModelingSession;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly renderer: ViewportRenderer;
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

  constructor(options: ThreeViewportAdapterOptions) {
    this.session = options.session;
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.viewportId = options.viewportId ?? "viewport-default";
    this.autoFlush = options.autoFlush !== false;
    this.spatialQuery = options.spatialQuery;
    this.ownsSpatialQuery = options.ownsSpatialQuery === true;
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
      this.session.events.on("document:changed", (change) => {
        if (this.syncing) {
          return;
        }
        if (change.kind === "transform" && change.objectIds && change.objectIds.length > 0) {
          this.markDirty(SceneDirtyFlag.Transforms);
          this.syncTransforms(change.objectIds);
          return;
        }
        if (change.kind === "visibility" && change.objectIds && change.objectIds.length > 0) {
          this.markDirty(SceneDirtyFlag.Visibility);
          this.syncVisibility(change.objectIds);
          return;
        }
        if (change.kind === "name" && change.objectIds && change.objectIds.length > 0) {
          this.syncNames(change.objectIds);
          return;
        }
        if (change.aspect === "material" || change.kind === "materials") {
          this.markDirty(SceneDirtyFlag.Materials);
          this.syncMaterialsOnly();
          return;
        }
        if (change.aspect === "texture") {
          this.markDirty(SceneDirtyFlag.Textures);
          this.flushOrSchedule();
          return;
        }
        this.markDirty(SceneDirtyFlag.Hierarchy);
        this.flushOrSchedule();
      }),
      this.session.events.on("mesh:changed", (change) => {
        if (this.syncing) {
          return;
        }
        if (change.meshIds.length > 0) {
          this.syncMeshesById(change.meshIds);
          const flags =
            change.kind === "uvs" || change.kind === "seams"
              ? MeshVisualDirtyFlag.UVs
              : change.kind === "positions"
                ? MeshVisualDirtyFlag.Positions | MeshVisualDirtyFlag.Normals
                : change.kind === "materials"
                  ? MeshVisualDirtyFlag.Materials
                  : MeshVisualDirtyFlag.Topology | MeshVisualDirtyFlag.Positions | MeshVisualDirtyFlag.Normals;
          for (const meshId of change.meshIds) {
            this.scheduler.invalidate(meshId, flags);
          }
          this.flushVisuals();
          return;
        }
        this.sync();
      }),
      this.session.events.on("selection:changed", () => {
        if (!this.syncing) {
          this.scheduler.invalidate(
            "*",
            MeshVisualDirtyFlag.VertexStates | MeshVisualDirtyFlag.EdgeStates | MeshVisualDirtyFlag.FaceStates,
          );
          this.flushVisuals();
        }
      }),
      this.session.events.on("animation:time-changed", () => {
        if (!this.syncing) {
          this.sync();
        }
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

  private flushOrSchedule(): void {
    if (this.autoFlush) {
      this.flushPending();
      return;
    }
  }

  sync(): void {
    this.assertAlive();
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    try {
      const live = new Set<ObjectId>();
      this.syncNode(this.session.document.scene.rootNodeId, this.root, live);
      for (const [id, tracked] of this.tracked) {
        if (!live.has(id)) {
          this.disposeTracked(tracked);
          this.tracked.delete(id);
        }
      }
      this.syncOverlays("full");
    } finally {
      this.syncing = false;
    }
  }

  private syncTransforms(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    for (const id of objectIds) {
      const node = this.session.document.scene.nodes.get(id);
      const tracked = this.tracked.get(id);
      if (!node || !tracked) {
        this.sync();
        return;
      }
      applyLocalTransform(tracked.object, resolveDisplayTransform(this.session, node));
    }
    this.syncOverlays("view");
  }

  private syncVisibility(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    for (const id of objectIds) {
      const node = this.session.document.scene.nodes.get(id);
      const tracked = this.tracked.get(id);
      if (!node || !tracked) {
        this.sync();
        return;
      }
      tracked.object.visible = getEffectiveVisibility(this.session.document, id);
    }
  }

  private syncNames(objectIds: readonly ObjectId[]): void {
    this.assertAlive();
    for (const id of objectIds) {
      const node = this.session.document.scene.nodes.get(id);
      const tracked = this.tracked.get(id);
      if (!node || !tracked) {
        return;
      }
      tracked.object.name = node.name;
    }
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    this.assertAlive();
    this.viewport = { width, height, pixelRatio };
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
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
    this.scheduler.invalidate("*", MeshVisualDirtyFlag.Theme | MeshVisualDirtyFlag.Visibility);
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
    const requestId = this.pickGate.next();
    if (!this.pickGate.isCurrent(requestId) || this.disposed) {
      return null;
    }
    const domain: PickDomain = options?.domain ?? "face";
    const pixelHitRadius = options?.pixelHitRadius ?? 10;
    this.root.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera);
    const hits = this.raycaster.intersectObject(this.root, true).filter((hit) => {
      if (hit.object.userData.isOverlay && !hit.object.userData.overlayPick) {
        return false;
      }
      if (options?.frontFacingOnly && hit.face) {
        return hit.face.normal.dot(this.raycaster.ray.direction) < 0;
      }
      return true;
    });
    const preferredObjectId = this.spatialQuery?.raycast({
      origin: {
        x: this.raycaster.ray.origin.x,
        y: this.raycaster.ray.origin.y,
        z: this.raycaster.ray.origin.z,
      },
      direction: {
        x: this.raycaster.ray.direction.x,
        y: this.raycaster.ray.direction.y,
        z: this.raycaster.ray.direction.z,
      },
    })?.objectId;
    if (preferredObjectId) {
      hits.sort((left, right) => {
        const leftMatch = left.object.userData.objectId === preferredObjectId ? 0 : 1;
        const rightMatch = right.object.userData.objectId === preferredObjectId ? 0 : 1;
        return leftMatch - rightMatch;
      });
    }
    const overlayResolved = (() => {
      for (const hit of hits) {
        const resolved = this.visualizer.resolveOverlayPick(hit.object, hit.instanceId);
        if (resolved && resolved.domain === domain) {
          return { hit, resolved };
        }
      }
      return undefined;
    })();
    if (overlayResolved?.resolved) {
      const objectId = this.objectIdFromOverlay(overlayResolved.hit.object);
      if (objectId) {
        return {
          domain,
          objectId,
          elementId: overlayResolved.resolved.elementId,
          ...(overlayResolved.resolved.domain === "vertex"
            ? { vertexId: overlayResolved.resolved.elementId as VertexId }
            : {}),
          ...(overlayResolved.resolved.domain === "edge"
            ? { edgeId: overlayResolved.resolved.elementId as EdgeId }
            : {}),
          point: {
            x: overlayResolved.hit.point.x,
            y: overlayResolved.hit.point.y,
            z: overlayResolved.hit.point.z,
          },
          distance: overlayResolved.hit.distance,
        };
      }
    }
    const hit = hits.find((item) => !item.object.userData.overlayPick);
    if (!hit) {
      return null;
    }
    const objectId = hit.object.userData.objectId as ObjectId | undefined;
    const meshId = hit.object.userData.meshId as MeshId | undefined;
    if (!objectId) {
      return null;
    }
    const tracked = this.tracked.get(objectId);
    const mapping = tracked?.mapping;
    const faceId = mapping ? resolveFaceId(hit, mapping) : undefined;
    const kernel = meshId ? this.session.meshes.get(meshId) : undefined;
    const localToWorld = (local: Vector3): Vector3 =>
      local.clone().applyMatrix4(hit.object.matrixWorld);
    const ndc = new Vector2(ndcX, ndcY);
    const point = {
      x: hit.point.x,
      y: hit.point.y,
      z: hit.point.z,
    };

    if (domain === "object") {
      return { domain, objectId, elementId: objectId, point, distance: hit.distance };
    }
    if (!faceId || !kernel) {
      return { domain: "object", objectId, elementId: objectId, point, distance: hit.distance };
    }
    if (domain === "vertex") {
      const vertexId = pickVertexOnFace(
        kernel,
        faceId,
        hit.point,
        localToWorld,
        this.camera,
        ndc,
        this.viewport,
        pixelHitRadius,
      );
      return {
        domain: "vertex",
        objectId,
        elementId: vertexId ?? faceId,
        faceId,
        ...(vertexId ? { vertexId } : {}),
        point,
        distance: hit.distance,
      };
    }
    if (domain === "edge") {
      const edgeId = pickEdgeOnFace(
        kernel,
        faceId,
        hit.point,
        localToWorld,
        this.camera,
        ndc,
        this.viewport,
        pixelHitRadius,
      );
      return {
        domain: "edge",
        objectId,
        elementId: edgeId ?? faceId,
        faceId,
        ...(edgeId ? { edgeId } : {}),
        point,
        distance: hit.distance,
      };
    }
    return {
      domain: "face",
      objectId,
      elementId: faceId,
      faceId,
      point,
      distance: hit.distance,
    };
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
      this.disposeTracked(tracked);
    }
    this.tracked.clear();
    this.clearLegacyOverlay();
    this.scheduler.dispose();
    this.visualizer.dispose();
    this.scene.remove(this.root);
    this.jobGeneration += 1;
    this.pickGate.invalidate();
    this.hoverStore.dispose();
    this.lifecycle.dispose();
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
  }

  private flushVisuals(): void {
    if (this.inViewFrame) {
      return;
    }
    this.scheduler.flushNow();
  }

  private syncNode(id: ObjectId, parent: Object3D, live: Set<ObjectId>): void {
    const node = this.session.document.scene.nodes.get(id);
    if (!node) {
      return;
    }
    live.add(id);
    const object = this.ensureObject(node);
    if (object.parent !== parent) {
      parent.add(object);
    }
    applyLocalTransform(object, resolveDisplayTransform(this.session, node));
    if (isMeshLikeNode(node) && node.payloadRef) {
      this.syncMesh(node, object as Mesh);
    }
    for (const childId of node.childIds) {
      this.syncNode(childId, object, live);
    }
  }

  private ensureObject(node: SceneNode): Object3D {
    const existing = this.tracked.get(node.id);
    if (existing) {
      return existing.object;
    }
    const object = isMeshLikeNode(node) ? new Mesh() : new Group();
    object.name = node.name;
    object.userData.objectId = node.id;
    if (isMeshLikeNode(node) && node.payloadRef) {
      object.userData.meshId = brand<string, "MeshId">(node.payloadRef);
    }
    if (node.type === "bone" && node.payloadRef) {
      object.userData.boneId = node.payloadRef;
    }
    if (object instanceof Mesh) {
      this.tracked.set(node.id, { object });
    } else {
      this.tracked.set(node.id, { object });
    }
    return object;
  }

  private syncMesh(node: SceneNode, object: Mesh): void {
    const meshId = brand<string, "MeshId">(node.payloadRef!);
    const kernel = this.session.meshes.get(meshId);
    const tracked = this.tracked.get(node.id);
    if (!kernel || !tracked) {
      return;
    }
    object.userData.meshId = meshId;
    const record = this.session.document.meshes.get(meshId);
    const materialKey = record
      ? `${this.session.document.materials.revision}:${record.materialIds.join(",")}`
      : "";
    const poseKey = `${this.session.animationTime}:${this.session.poseLocals.size}`;
    let handle = this.geometries.get(meshId);
    if (!handle) {
      const next = syncDerivedGeometry(kernel);
      handle = {
        geometry: next.geometry,
        mapping: next.mapping,
        revision: kernel.revision,
        topologyRevision: kernel.topologyRevision,
        uvRevision: kernel.uvRevision,
        refs: 0,
      };
      this.geometries.set(meshId, handle);
    } else if (handle.revision !== kernel.revision) {
      const next = syncDerivedGeometry(kernel, { geometry: handle.geometry, mapping: handle.mapping });
      if (!next.reused) {
        handle.geometry.dispose();
      }
      handle.geometry = next.geometry;
      handle.mapping = next.mapping;
      handle.revision = kernel.revision;
      handle.topologyRevision = kernel.topologyRevision;
      handle.uvRevision = kernel.uvRevision;
    }
    if (tracked.geometry !== handle.geometry) {
      if (tracked.geometry) {
        this.releaseGeometry(tracked.object.userData.meshId as MeshId | undefined, tracked.geometry);
      }
      handle.refs += 1;
      object.geometry = handle.geometry;
      tracked.geometry = handle.geometry;
      tracked.mapping = handle.mapping;
    }
    tracked.meshRevision = kernel.revision;
    if (record && tracked.geometry && tracked.mapping) {
      applyFaceMaterialGroups(tracked.geometry, kernel, tracked.mapping);
      if (tracked.materialKey !== materialKey) {
        const nextMaterials = materialsForRecord(this.session.document, record);
        disposeMaterials(tracked.material);
        object.material = nextMaterials.length === 1 ? nextMaterials[0]! : nextMaterials;
        tracked.material = object.material;
        tracked.materialKey = materialKey;
      }
      if (this.session.poseLocals.size > 0 && tracked.poseKey !== poseKey) {
        applyCpuSkin(this.session, record, kernel, tracked.geometry, tracked.mapping);
      }
      tracked.poseKey = poseKey;
    }
  }

  private syncMaterialsOnly(): void {
    this.assertAlive();
    for (const [objectId, tracked] of this.tracked) {
      if (!(tracked.object instanceof Mesh)) {
        continue;
      }
      const node = this.session.document.scene.nodes.get(objectId);
      if (!node || !isMeshLikeNode(node) || !node.payloadRef) {
        continue;
      }
      const meshId = brand<string, "MeshId">(node.payloadRef);
      const kernel = this.session.meshes.get(meshId);
      const record = this.session.document.meshes.get(meshId);
      if (!kernel || !record || !tracked.geometry || !tracked.mapping) {
        continue;
      }
      const materialKey = `${this.session.document.materials.revision}:${record.materialIds.join(",")}`;
      applyFaceMaterialGroups(tracked.geometry, kernel, tracked.mapping);
      if (tracked.materialKey !== materialKey) {
        const nextMaterials = materialsForRecord(this.session.document, record);
        disposeMaterials(tracked.material);
        tracked.object.material = nextMaterials.length === 1 ? nextMaterials[0]! : nextMaterials;
        tracked.material = tracked.object.material;
        tracked.materialKey = materialKey;
      }
    }
  }

  private releaseGeometry(meshId: MeshId | undefined, geometry: BufferGeometry): void {
    if (!meshId) {
      geometry.dispose();
      return;
    }
    const handle = this.geometries.get(meshId);
    if (!handle || handle.geometry !== geometry) {
      geometry.dispose();
      return;
    }
    handle.refs = Math.max(0, handle.refs - 1);
    if (handle.refs === 0) {
      handle.geometry.dispose();
      this.geometries.delete(meshId);
    }
  }

  private syncMeshesById(meshIds: readonly string[]): void {
    const wanted = new Set(meshIds);
    for (const [objectId, tracked] of this.tracked) {
      const meshId = tracked.object.userData.meshId as MeshId | undefined;
      if (!meshId || !wanted.has(meshId) || !(tracked.object instanceof Mesh)) {
        continue;
      }
      const node = this.session.document.scene.nodes.get(objectId);
      if (node) {
        this.syncMesh(node, tracked.object);
      }
    }
  }

  private objectIdFromOverlay(object: Object3D): ObjectId | undefined {
    let current: Object3D | null = object;
    while (current) {
      const id = current.userData.objectId as ObjectId | undefined;
      if (id) {
        return id;
      }
      current = current.parent;
    }
    return undefined;
  }

  private collectOverlaySources(): OverlayMeshSource[] {
    let count = 0;
    for (const [objectId, tracked] of this.tracked) {
      if (!tracked.geometry || !tracked.mapping || !(tracked.object instanceof Mesh)) {
        continue;
      }
      const meshId = tracked.object.userData.meshId as MeshId | undefined;
      const kernel = meshId ? this.session.meshes.get(meshId) : undefined;
      if (!kernel) {
        continue;
      }
      const existing = this.overlaySources[count];
      if (existing) {
        (existing as { objectId: ObjectId }).objectId = objectId;
        (existing as { object: Object3D }).object = tracked.object;
        (existing as { kernel: typeof kernel }).kernel = kernel;
        (existing as { geometry: BufferGeometry }).geometry = tracked.geometry;
        (existing as { mapping: RenderMapping }).mapping = tracked.mapping;
      } else {
        this.overlaySources[count] = {
          objectId,
          object: tracked.object,
          kernel,
          geometry: tracked.geometry,
          mapping: tracked.mapping,
        };
      }
      count += 1;
    }
    this.overlaySources.length = count;
    return this.overlaySources;
  }

  private syncOverlays(mode: "full" | "state" | "view" = "full"): void {
    this.assertAlive();
    if (!this.visualizer.getDisplay().enabled) {
      this.syncLegacyOverlays();
      return;
    }
    this.visualizer.sync(this.collectOverlaySources(), this.session.selection, {
      camera: this.camera,
      width: this.viewport.width,
      height: this.viewport.height,
    }, mode);
  }

  private syncLegacyOverlays(): void {
    this.clearLegacyOverlay();
    const selected = this.session.selection;
    const domain = selected.domain;
    if (domain !== "face" && domain !== "edge" && domain !== "vertex" && domain !== "object") {
      return;
    }
    if (domain !== "object" && selected.elementIds.length === 0) {
      return;
    }
    for (const objectId of selected.objectIds) {
      const tracked = this.tracked.get(objectId);
      if (!tracked?.geometry || !tracked.mapping || !(tracked.object instanceof Mesh)) {
        continue;
      }
      const meshId = tracked.object.userData.meshId as MeshId | undefined;
      const kernel = meshId ? this.session.meshes.get(meshId) : undefined;
      if (!kernel) {
        continue;
      }
      const overlay = buildSelectionOverlay({
        domain,
        elementIds: selected.elementIds,
        kernel,
        geometry: tracked.geometry,
        mapping: tracked.mapping,
      });
      if (!overlay) {
        continue;
      }
      tracked.object.add(overlay);
      this.overlayObjects.push(overlay);
    }
  }

  private clearLegacyOverlay(): void {
    for (const object of this.overlayObjects) {
      disposeOverlayObject(object);
    }
    this.overlayObjects.length = 0;
  }

  private disposeTracked(tracked: TrackedObject): void {
    tracked.object.removeFromParent();
    if (tracked.geometry) {
      this.releaseGeometry(tracked.object.userData.meshId as MeshId | undefined, tracked.geometry);
    }
    disposeMaterials(tracked.material);
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error("ThreeViewportAdapter has been disposed");
    }
  }
}

function resolveDisplayTransform(
  session: ModelingSession,
  node: SceneNode,
): SceneNode["localTransform"] {
  if (node.type === "bone" && node.payloadRef) {
    const posed = session.poseLocals.get(brand<string, "BoneId">(node.payloadRef));
    if (posed) {
      return posed;
    }
  }
  const objectPose = session.objectPoseLocals.get(node.id);
  if (objectPose) {
    return objectPose;
  }
  return node.localTransform;
}

function applyLocalTransform(object: Object3D, transform: SceneNode["localTransform"]): void {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.quaternion.set(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
  );
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}

export type { PickDomain, PickResult, PickingOptions };
