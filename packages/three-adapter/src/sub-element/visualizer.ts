import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  FrontSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
} from "three";
import type { RenderMapping } from "../geometry";
import { IdIndexMap } from "./id-index";
import { isLodIndexVisible, planElementLod } from "./lod";
import { classifyEdge, faceOutlinePositions, hexToRgb } from "./mesh-query";
import { CompactElementStates } from "./element-flags";
import { MeshVisualLifecycleMachine } from "./lifecycle";
import { emptyDiagnostics, type SubElementDiagnostics } from "./diagnostics";
import { GpuResourceTracker } from "./resources";
import { resolveElementVisualState } from "./resolve-state";
import { clampPixelSize, worldSizeForPixels } from "./screen-space";
import {
  defaultSubElementDisplay,
  defaultSubElementTheme,
  mergeSubElementDisplay,
  mergeSubElementTheme,
} from "./theme";
import type {
  CustomVertexMarker,
  DeepPartial,
  ElementDomain,
  ElementIdSets,
  SubElementDisplayOptions,
  SubElementHover,
  SubElementVisualTheme,
  VertexMarkerStyle,
} from "./types";

export interface OverlayMeshSource {
  readonly objectId: ObjectId;
  readonly object: Object3D;
  readonly kernel: HalfEdgeMesh;
  readonly geometry: BufferGeometry;
  readonly mapping: RenderMapping;
}

type OverlaySelectionDomain =
  | "none"
  | "object"
  | "vertex"
  | "edge"
  | "face"
  | "uv"
  | "bone"
  | "keyframe";

export interface VisualizerView {
  readonly camera: Camera;
  readonly width: number;
  readonly height: number;
}

interface ObjectLayer {
  readonly group: Group;
  readonly vertices: IdIndexMap<VertexId>;
  readonly edges: IdIndexMap<EdgeId>;
  readonly faces: IdIndexMap<FaceId>;
  readonly resources: GpuResourceTracker;
  meshRevision: number;
  vertexMesh?: InstancedMesh | Points;
  vertexPick?: InstancedMesh;
  edgeLines?: LineSegments;
  edgeThick?: InstancedMesh;
  faceFill?: Mesh;
  faceOutline?: LineSegments;
  vertexPositions: Float32Array;
  edgeEndpoints: Float32Array;
  lastViewHash: number;
  presentationKey: string;
  readonly vertexStates: CompactElementStates;
  readonly edgeStates: CompactElementStates;
  readonly faceStates: CompactElementStates;
}

const _color = new Color();
const _matrix = new Matrix4();
const _scale = new Vector3();
const _from = new Vector3();
const _to = new Vector3();
const _dir = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();
const _mid = new Vector3();
const _camPos = new Vector3();
const _xAxis = new Vector3(1, 0, 0);

export class SubElementVisualizer {
  readonly group = new Group();
  readonly resources = new GpuResourceTracker();
  readonly pointerGeneration = { value: 0 };
  readonly lifecycle = new MeshVisualLifecycleMachine();
  lastPatchedIndices: number[] = [];
  private theme: SubElementVisualTheme = defaultSubElementTheme;
  private previousHover: SubElementHover | null = null;
  private lastFailure: string | undefined;
  private display: SubElementDisplayOptions = defaultSubElementDisplay;
  private hover: SubElementHover | null = null;
  private extraFlags: Pick<ElementIdSets, "disabled" | "locked" | "hidden"> = {
    disabled: new Set(),
    locked: new Set(),
    hidden: new Set(),
  };
  private readonly layers = new Map<ObjectId, ObjectLayer>();
  private readonly shared = {
    cube: this.resources.trackGeometry(new BoxGeometry(1, 1, 1)),
    sphere: this.resources.trackGeometry(new SphereGeometry(0.5, 12, 8)),
    stick: this.resources.trackGeometry(new BoxGeometry(1, 1, 1)),
  };
  private customVertex: CustomVertexMarker | null = null;
  private spriteTextures: { square?: CanvasTexture; circle?: CanvasTexture } = {};
  private syncing = false;
  private lastSelectionKey = "";
  private lastCoreSelectionKey = "";
  private lastHoverKey = "";
  private lastSelection: {
    domain: OverlaySelectionDomain;
    objectIds: readonly ObjectId[];
    elementIds: readonly string[];
    activeId: string | null;
  } | null = null;
  private fillScratch: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private fillColorScratch: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private outlineScratch: Float32Array<ArrayBufferLike> = new Float32Array(0);
  readonly perf = {
    topologyRebuilds: 0,
    positionRefreshes: 0,
    skippedViews: 0,
    stateUpdates: 0,
    lastUpdateDurationMs: 0,
  };

  constructor() {
    this.group.name = "sub-element-overlay";
    this.group.userData.isOverlay = true;
    this.lifecycle.transition("building");
    this.lifecycle.transition("ready");
  }

  getDisplay(): SubElementDisplayOptions {
    return this.display;
  }

  getTheme(): SubElementVisualTheme {
    return this.theme;
  }

  setTheme(patch?: DeepPartial<SubElementVisualTheme>): void {
    this.theme = mergeSubElementTheme(defaultSubElementTheme, patch);
    this.lastSelectionKey = "";
    this.lastCoreSelectionKey = "";
    this.lastHoverKey = "";
    for (const layer of this.layers.values()) {
      layer.meshRevision = -1;
    }
  }

  setDisplay(patch?: DeepPartial<SubElementDisplayOptions>): void {
    this.display = mergeSubElementDisplay(defaultSubElementDisplay, patch);
    this.lastSelectionKey = "";
  }

  setCustomVertexMarker(marker: CustomVertexMarker | null): void {
    this.customVertex = marker;
    this.lastSelectionKey = "";
  }

  setHover(hover: SubElementHover | null): boolean {
    const key = hover ? `${hover.objectId}:${hover.domain}:${hover.elementId}` : "";
    if (key === this.lastHoverKey) {
      return false;
    }
    this.previousHover = this.hover;
    this.hover = hover;
    this.lastHoverKey = key;
    return true;
  }

  setElementFlags(flags: Partial<Pick<ElementIdSets, "disabled" | "locked" | "hidden">>): void {
    this.extraFlags = {
      disabled: flags.disabled ?? this.extraFlags.disabled,
      locked: flags.locked ?? this.extraFlags.locked,
      hidden: flags.hidden ?? this.extraFlags.hidden,
    };
    this.lastSelectionKey = "";
  }

  resolveOverlayPick(
    object: Object3D,
    instanceId: number | undefined,
  ): { domain: ElementDomain; elementId: string } | null {
    if (!object.userData.overlayPick || instanceId === undefined || instanceId < 0) {
      return null;
    }
    for (const layer of this.layers.values()) {
      if (object === layer.vertexPick) {
        const id = layer.vertices.getId(instanceId);
        return id ? { domain: "vertex", elementId: id } : null;
      }
      if (object === layer.edgeThick) {
        const id = layer.edges.getId(instanceId);
        return id ? { domain: "edge", elementId: id } : null;
      }
    }
    return null;
  }

  liveElementIds(): Set<string> {
    const ids = new Set<string>();
    for (const layer of this.layers.values()) {
      for (let i = 0; i < layer.vertices.size; i += 1) {
        ids.add(layer.vertices.getId(i)!);
      }
      for (let i = 0; i < layer.edges.size; i += 1) {
        ids.add(layer.edges.getId(i)!);
      }
      for (let i = 0; i < layer.faces.size; i += 1) {
        ids.add(layer.faces.getId(i)!);
      }
    }
    return ids;
  }

  diagnostics(): SubElementDiagnostics {
    const counts = this.gpuCounts();
    let vertexCount = 0;
    let edgeCount = 0;
    let faceCount = 0;
    for (const layer of this.layers.values()) {
      vertexCount += layer.vertices.size;
      edgeCount += layer.edges.size;
      faceCount += layer.faces.size;
    }
    return {
      ...emptyDiagnostics(this.lifecycle.state),
      vertexCount,
      edgeCount,
      faceCount,
      topologyRebuildCount: this.perf.topologyRebuilds,
      partialUpdateCount: this.perf.positionRefreshes + this.perf.stateUpdates,
      activeResources: counts.geometries + counts.materials + counts.textures,
      lastUpdateDurationMs: this.perf.lastUpdateDurationMs,
      ...(this.lastFailure !== undefined ? { lastFailure: this.lastFailure } : {}),
    };
  }

  gpuCounts(): { geometries: number; materials: number; textures: number; layers: number } {
    const counts = { ...this.resources.counts, layers: this.layers.size };
    for (const layer of this.layers.values()) {
      const local = layer.resources.counts;
      counts.geometries += local.geometries;
      counts.materials += local.materials;
      counts.textures += local.textures;
    }
    return counts;
  }

  sync(
    sources: readonly OverlayMeshSource[],
    selection: {
      domain: OverlaySelectionDomain;
      objectIds: readonly ObjectId[];
      elementIds: readonly string[];
      activeId: string | null;
    },
    view: VisualizerView,
    mode: "full" | "state" | "view" = "full",
  ): void {
    if (!this.lifecycle.isAlive || this.lifecycle.state === "failed") {
      return;
    }
    if (!this.display.enabled || this.syncing) {
      return;
    }
    this.syncing = true;
    if (this.lifecycle.state === "ready") {
      this.lifecycle.transition("updating");
    }
    const started = this.nowMs();
    try {
      const live = new Set<ObjectId>();
      const changes = new Map<ObjectId, "none" | "positions" | "topology">();
      for (const source of sources) {
        live.add(source.objectId);
        changes.set(source.objectId, mode === "view" ? "none" : this.ensureLayer(source));
      }
      this.pruneHover();
      const coreKey = `${selection.domain}|${selection.objectIds.join(",")}|${selection.elementIds.join(",")}|${selection.activeId}`;
      const selectionKey = `${coreKey}|${this.lastHoverKey}`;
      const stateChanged = selectionKey !== this.lastSelectionKey;
      const hoverOnly =
        mode === "state" &&
        coreKey === this.lastCoreSelectionKey &&
        this.lastCoreSelectionKey !== "" &&
        stateChanged;
      this.lastSelection = selection;
      for (const source of sources) {
        const change = changes.get(source.objectId) ?? "none";
        if (hoverOnly && change === "none") {
          this.patchHoverState(source, selection);
        } else if (change !== "none" || stateChanged || mode === "state") {
          this.updateLayerState(source, selection);
          this.perf.stateUpdates += 1;
        }
        this.updateScreenSpace(source, view, change !== "none");
      }
      if (mode !== "view") {
        for (const [id, layer] of this.layers) {
          if (!live.has(id)) {
            this.disposeLayer(layer);
            this.layers.delete(id);
          }
        }
      }
      this.lastSelectionKey = selectionKey;
      this.lastCoreSelectionKey = coreKey;
      this.pruneHover();
      this.lastFailure = undefined;
      if (this.lifecycle.state === "updating") {
        this.lifecycle.transition("ready");
      }
    } catch (error) {
      this.lastFailure = error instanceof Error ? error.message : String(error);
      if (this.lifecycle.state === "updating") {
        this.lifecycle.transition("failed");
      }
      throw error;
    } finally {
      if (this.lifecycle.state === "updating") {
        this.lifecycle.transition("ready");
      }
      this.perf.lastUpdateDurationMs = this.nowMs() - started;
      this.syncing = false;
    }
  }

  private nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  pruneHover(): void {
    if (!this.hover) {
      return;
    }
    const layer = this.layers.get(this.hover.objectId);
    if (!layer) {
      this.setHover(null);
      return;
    }
    const exists =
      this.hover.domain === "vertex"
        ? layer.vertices.getIndex(this.hover.elementId) !== undefined
        : this.hover.domain === "edge"
          ? layer.edges.getIndex(this.hover.elementId) !== undefined
          : layer.faces.getIndex(this.hover.elementId) !== undefined;
    if (!exists) {
      this.setHover(null);
    }
  }

  dispose(): void {
    if (this.lifecycle.state === "disposed" || this.lifecycle.state === "disposing") {
      return;
    }
    this.lifecycle.dispose();
    for (const layer of this.layers.values()) {
      this.disposeLayer(layer);
    }
    this.layers.clear();
    this.resources.dispose();
    this.group.removeFromParent();
    this.syncing = false;
  }

  private ensureLayer(source: OverlayMeshSource): "none" | "positions" | "topology" {
    let layer = this.layers.get(source.objectId);
    if (!layer) {
      const group = new Group();
      group.name = "selection-overlay";
      group.userData.isOverlay = true;
      group.userData.overlayKind = "sub-element";
      source.object.add(group);
      layer = {
        group,
        vertices: new IdIndexMap<VertexId>(),
        edges: new IdIndexMap<EdgeId>(),
        faces: new IdIndexMap<FaceId>(),
        resources: new GpuResourceTracker(),
        meshRevision: -1,
        vertexPositions: new Float32Array(0),
        edgeEndpoints: new Float32Array(0),
        lastViewHash: Number.NaN,
        presentationKey: "",
        vertexStates: new CompactElementStates(),
        edgeStates: new CompactElementStates(),
        faceStates: new CompactElementStates(),
      };
      this.layers.set(source.objectId, layer);
    }
    if (layer.group.parent !== source.object) {
      source.object.add(layer.group);
    }
    const presentation = this.presentationKey();
    if (layer.presentationKey !== presentation) {
      this.rebuildTopology(layer, source);
      layer.meshRevision = source.kernel.revision;
      layer.presentationKey = presentation;
      this.perf.topologyRebuilds += 1;
      return "topology";
    }
    if (layer.meshRevision === source.kernel.revision) {
      return "none";
    }
    const idsChanged =
      layer.vertices.rebuild(source.kernel.vertices.keys()) ||
      layer.edges.rebuild(source.kernel.edges.keys()) ||
      layer.faces.rebuild(source.kernel.faces.keys());
    if (!idsChanged && layer.vertexPositions.length === source.kernel.vertices.size * 3) {
      this.refreshPositions(layer, source);
      layer.meshRevision = source.kernel.revision;
      this.perf.positionRefreshes += 1;
      return "positions";
    }
    this.rebuildTopology(layer, source);
    layer.meshRevision = source.kernel.revision;
    layer.presentationKey = presentation;
    this.perf.topologyRebuilds += 1;
    return "topology";
  }

  private presentationKey(): string {
    const vertices = this.theme.vertices;
    const edges = this.theme.edges;
    return `${vertices.style}|${vertices.pixelSize}|${edges.style}|${this.theme.faces.style}`;
  }

  private refreshPositions(layer: ObjectLayer, source: OverlayMeshSource): void {
    const vCount = layer.vertices.size;
    for (let i = 0; i < vCount; i += 1) {
      const id = layer.vertices.getId(i)!;
      const p = source.kernel.vertices.get(id)?.position;
      if (!p) {
        continue;
      }
      layer.vertexPositions[i * 3] = p[0];
      layer.vertexPositions[i * 3 + 1] = p[1];
      layer.vertexPositions[i * 3 + 2] = p[2];
    }
    const eCount = layer.edges.size;
    for (let i = 0; i < eCount; i += 1) {
      const id = layer.edges.getId(i)!;
      const ends = source.kernel.getEdgeVertices(id);
      if (!ends) {
        continue;
      }
      const a = source.kernel.vertices.get(ends[0])!.position;
      const b = source.kernel.vertices.get(ends[1])!.position;
      const o = i * 6;
      layer.edgeEndpoints[o] = a[0];
      layer.edgeEndpoints[o + 1] = a[1];
      layer.edgeEndpoints[o + 2] = a[2];
      layer.edgeEndpoints[o + 3] = b[0];
      layer.edgeEndpoints[o + 4] = b[1];
      layer.edgeEndpoints[o + 5] = b[2];
    }
    const pointMesh = layer.vertexMesh;
    if (pointMesh instanceof Points) {
      const attr = pointMesh.geometry.getAttribute("position");
      if (attr) {
        attr.needsUpdate = true;
      }
    }
    if (layer.edgeLines) {
      const attr = layer.edgeLines.geometry.getAttribute("position");
      if (attr) {
        attr.needsUpdate = true;
      }
    }
    layer.lastViewHash = Number.NaN;
  }

  private rebuildTopology(layer: ObjectLayer, source: OverlayMeshSource): void {
    this.clearLayerMeshes(layer);
    layer.resources.dispose();
    layer.vertices.rebuild(source.kernel.vertices.keys());
    layer.edges.rebuild(source.kernel.edges.keys());
    layer.faces.rebuild(source.kernel.faces.keys());
    const vCount = layer.vertices.size;
    const eCount = layer.edges.size;
    layer.vertexPositions = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i += 1) {
      const id = layer.vertices.getId(i)!;
      const p = source.kernel.vertices.get(id)!.position;
      layer.vertexPositions.set(p, i * 3);
    }
    layer.edgeEndpoints = new Float32Array(eCount * 6);
    for (let i = 0; i < eCount; i += 1) {
      const id = layer.edges.getId(i)!;
      const ends = source.kernel.getEdgeVertices(id);
      if (!ends) {
        continue;
      }
      const a = source.kernel.vertices.get(ends[0])!.position;
      const b = source.kernel.vertices.get(ends[1])!.position;
      const o = i * 6;
      layer.edgeEndpoints[o] = a[0];
      layer.edgeEndpoints[o + 1] = a[1];
      layer.edgeEndpoints[o + 2] = a[2];
      layer.edgeEndpoints[o + 3] = b[0];
      layer.edgeEndpoints[o + 4] = b[1];
      layer.edgeEndpoints[o + 5] = b[2];
    }
    this.buildVertexMeshes(layer);
    this.buildEdgeMeshes(layer);
    layer.vertexStates.resize(vCount);
    layer.edgeStates.resize(eCount);
    layer.faceStates.resize(layer.faces.size);
    this.buildFaceMeshes(layer, source);
    layer.lastViewHash = Number.NaN;
    layer.presentationKey = this.presentationKey();
  }

  private buildVertexMeshes(layer: ObjectLayer): void {
    const count = Math.max(1, layer.vertices.size);
    const style = this.theme.vertices.style;
    const pickGeom = this.shared.cube;
    const pickMat = layer.resources.trackMaterial(
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0x000000,
      }),
    ) as MeshBasicMaterial;
    const pick = new InstancedMesh(pickGeom, pickMat, count);
    pick.frustumCulled = false;
    pick.userData.isOverlay = true;
    pick.userData.overlayPick = true;
    pick.userData.overlayKind = "vertex-pick";
    pick.name = "vertex-pick-overlay";
    layer.group.add(pick);
    layer.vertexPick = pick;

    if (style === "square-sprite" || style === "circle-sprite") {
      const points = new Points(this.makeVertexPointGeometry(layer), this.makeSpriteMaterial(layer, style));
      points.frustumCulled = false;
      points.userData.isOverlay = true;
      points.userData.overlayKind = "vertex";
      points.name = "vertex-overlay";
      layer.group.add(points);
      layer.vertexMesh = points;
      return;
    }
    if (style === "hidden") {
      return;
    }
    const visual = new InstancedMesh(this.vertexGeometry(style), this.vertexMaterial(layer, style), count);
    visual.frustumCulled = false;
    visual.userData.isOverlay = true;
    visual.userData.overlayKind = "vertex";
    visual.name = "vertex-overlay";
    layer.group.add(visual);
    layer.vertexMesh = visual;
  }

  private buildEdgeMeshes(layer: ObjectLayer): void {
    const count = Math.max(1, layer.edges.size);
    const positions = layer.resources.trackGeometry(new BufferGeometry());
    positions.setAttribute("position", new BufferAttribute(layer.edgeEndpoints, 3));
    positions.setAttribute("color", new BufferAttribute(new Float32Array(layer.edges.size * 6), 3));
    const dashed = this.theme.edges.style === "dashed";
    const lineMat = dashed
      ? new LineDashedMaterial({
          vertexColors: true,
          dashSize: 0.08,
          gapSize: 0.05,
          depthTest: this.theme.edges.depthTest && !this.theme.edges.xray,
          transparent: true,
        })
      : new LineBasicMaterial({
          vertexColors: true,
          depthTest: this.theme.edges.depthTest && !this.theme.edges.xray,
          transparent: true,
        });
    layer.resources.trackMaterial(lineMat);
    const lines = new LineSegments(positions, lineMat);
    lines.computeLineDistances();
    lines.frustumCulled = false;
    lines.userData.isOverlay = true;
    lines.userData.overlayKind = "edge";
    lines.name = "edge-overlay";
    lines.userData.segmentCount = layer.edges.size;
    layer.group.add(lines);
    layer.edgeLines = lines;

    if (this.theme.edges.style === "screen-space") {
      const thick = new InstancedMesh(
        this.shared.stick,
        layer.resources.trackMaterial(
          new MeshBasicMaterial({
            vertexColors: false,
            transparent: true,
            depthTest: this.theme.edges.depthTest && !this.theme.edges.xray,
          }),
        ) as MeshBasicMaterial,
        count,
      );
      thick.frustumCulled = false;
      thick.userData.isOverlay = true;
      thick.userData.overlayPick = true;
      thick.userData.overlayKind = "edge-thick";
      thick.name = "edge-thick-overlay";
      layer.group.add(thick);
      layer.edgeThick = thick;
    }
  }

  private buildFaceMeshes(layer: ObjectLayer, source: OverlayMeshSource): void {
    const fillGeom = layer.resources.trackGeometry(new BufferGeometry());
    fillGeom.setAttribute("position", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
    fillGeom.setAttribute("color", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
    const fillMat = layer.resources.trackMaterial(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: this.theme.faces.depthTest && !this.theme.faces.xray,
        side: this.theme.faces.frontFaceOnly ? FrontSide : DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    ) as MeshBasicMaterial;
    const fill = new Mesh(fillGeom, fillMat);
    fill.frustumCulled = false;
    fill.userData.isOverlay = true;
    fill.userData.overlayKind = "face";
    fill.name = "face-fill-overlay";
    layer.group.add(fill);
    layer.faceFill = fill;

    const outlineGeom = layer.resources.trackGeometry(new BufferGeometry());
    outlineGeom.setAttribute("position", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
    const outline = new LineSegments(
      outlineGeom,
      layer.resources.trackMaterial(
        new LineBasicMaterial({
          vertexColors: false,
          color: 0xffdd88,
          transparent: true,
          depthTest: this.theme.faces.depthTest && !this.theme.faces.xray,
        }),
      ) as LineBasicMaterial,
    );
    outline.frustumCulled = false;
    outline.userData.isOverlay = true;
    outline.userData.overlayKind = "face-outline";
    outline.name = "selection-overlay";
    layer.group.add(outline);
    layer.faceOutline = outline;
    void source;
  }

  private updateLayerState(
    source: OverlayMeshSource,
    selection: {
      domain: OverlaySelectionDomain;
      objectIds: readonly ObjectId[];
      elementIds: readonly string[];
      activeId: string | null;
    },
  ): void {
    const layer = this.layers.get(source.objectId);
    if (!layer) {
      return;
    }
    const selectedHere = selection.objectIds.includes(source.objectId);
    const selected = new Set(selectedHere ? selection.elementIds : []);
    const sets: ElementIdSets = {
      ...this.extraFlags,
      selected,
      active: selectedHere ? selection.activeId : null,
      hovered:
        this.hover && this.hover.objectId === source.objectId ? this.hover.elementId : null,
    };
    const domain = selection.domain;
    const showV = this.shouldShow("vertices", domain);
    const showE = this.shouldShow("edges", domain);
    const showF = this.display.showFaces !== false;

    if (layer.vertexMesh) {
      layer.vertexMesh.visible = showV;
    }
    if (layer.vertexPick) {
      layer.vertexPick.visible = showV || this.theme.vertices.style === "hidden";
    }
    if (layer.edgeLines) {
      layer.edgeLines.visible = showE && this.theme.edges.style !== "screen-space";
    }
    if (layer.edgeThick) {
      layer.edgeThick.visible = showE && this.theme.edges.style === "screen-space";
    }
    this.writeVertexColors(layer, sets, showV);
    this.writeEdgeColors(layer, source.kernel, sets, showE);
    this.writeFaces(layer, source, sets, showF, domain);
  }

  private patchHoverState(
    source: OverlayMeshSource,
    selection: {
      domain: OverlaySelectionDomain;
      objectIds: readonly ObjectId[];
      elementIds: readonly string[];
      activeId: string | null;
    },
  ): void {
    const layer = this.layers.get(source.objectId);
    if (!layer) {
      return;
    }
    const sets = this.elementSets(source.objectId, selection);
    const domain = this.hover?.domain ?? this.previousHover?.domain;
    if (domain === "vertex") {
      const previous =
        this.previousHover?.objectId === source.objectId && this.previousHover.domain === "vertex"
          ? layer.vertices.getIndex(this.previousHover.elementId)
          : undefined;
      const next =
        this.hover?.objectId === source.objectId && this.hover.domain === "vertex"
          ? layer.vertices.getIndex(this.hover.elementId)
          : undefined;
      layer.vertexStates.replaceHover(previous, next);
      this.lastPatchedIndices = [...layer.vertexStates.patchedIndices];
      for (const index of this.lastPatchedIndices) {
        this.writeVertexColorAt(layer, index, sets);
      }
      return;
    }
    if (domain === "edge") {
      const previous =
        this.previousHover?.objectId === source.objectId && this.previousHover.domain === "edge"
          ? layer.edges.getIndex(this.previousHover.elementId)
          : undefined;
      const next =
        this.hover?.objectId === source.objectId && this.hover.domain === "edge"
          ? layer.edges.getIndex(this.hover.elementId)
          : undefined;
      layer.edgeStates.replaceHover(previous, next);
      this.lastPatchedIndices = [...layer.edgeStates.patchedIndices];
      for (const index of this.lastPatchedIndices) {
        this.writeEdgeColorAt(layer, source.kernel, index, sets);
      }
      return;
    }
    this.updateLayerState(source, selection);
    this.perf.stateUpdates += 1;
  }

  private elementSets(
    objectId: ObjectId,
    selection: {
      objectIds: readonly ObjectId[];
      elementIds: readonly string[];
      activeId: string | null;
    },
  ): ElementIdSets {
    const selectedHere = selection.objectIds.includes(objectId);
    return {
      ...this.extraFlags,
      selected: new Set(selectedHere ? selection.elementIds : []),
      active: selectedHere ? selection.activeId : null,
      hovered: this.hover && this.hover.objectId === objectId ? this.hover.elementId : null,
    };
  }

  private writeVertexColorAt(layer: ObjectLayer, index: number, sets: ElementIdSets): void {
    const id = layer.vertices.getId(index);
    if (!id) {
      return;
    }
    const state = resolveElementVisualState(id, sets);
    const style = this.theme.vertices.states[state];
    const mesh = layer.vertexMesh;
    if (mesh instanceof Points) {
      const colors = mesh.geometry.getAttribute("color") as BufferAttribute;
      const [r, g, b] = hexToRgb(style.color);
      const a = state === "hidden" ? 0 : style.opacity;
      colors.setXYZ(index, r * a, g * a, b * a);
      colors.needsUpdate = true;
      return;
    }
    if (mesh instanceof InstancedMesh) {
      _color.setHex(style.color);
      mesh.setColorAt(index, _color);
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private writeEdgeColorAt(
    layer: ObjectLayer,
    kernel: HalfEdgeMesh,
    index: number,
    sets: ElementIdSets,
  ): void {
    const id = layer.edges.getId(index);
    if (!id || !layer.edgeLines) {
      return;
    }
    const state = resolveElementVisualState(id, sets);
    const role = classifyEdge(kernel, id);
    const roleStyle = this.theme.edges.roles[role];
    const stateStyle = this.theme.edges.states[state];
    const color = state === "default" ? roleStyle.color : stateStyle.color;
    const opacity = state === "hidden" ? 0 : state === "default" ? roleStyle.opacity : stateStyle.opacity;
    const [r, g, b] = hexToRgb(color);
    const colors = layer.edgeLines.geometry.getAttribute("color") as BufferAttribute;
    colors.setXYZ(index * 2, r * opacity, g * opacity, b * opacity);
    colors.setXYZ(index * 2 + 1, r * opacity, g * opacity, b * opacity);
    colors.needsUpdate = true;
    if (layer.edgeThick) {
      _color.setRGB(r, g, b);
      layer.edgeThick.setColorAt(index, _color);
      if (layer.edgeThick.instanceColor) {
        layer.edgeThick.instanceColor.needsUpdate = true;
      }
    }
  }

  private writeVertexColors(layer: ObjectLayer, sets: ElementIdSets, show: boolean): void {
    if (!show && this.theme.vertices.style !== "hidden") {
      return;
    }
    const lod = planElementLod(layer.vertices.size, this.display.lod.maxVertices, this.display.lod);
    const mesh = layer.vertexMesh;
    if (mesh instanceof Points) {
      const colors = mesh.geometry.getAttribute("color") as BufferAttribute;
      for (let i = 0; i < layer.vertices.size; i += 1) {
        const id = layer.vertices.getId(i)!;
        const state = resolveElementVisualState(id, sets);
        const emphasized = state !== "default";
        const visible = isLodIndexVisible(i, lod, emphasized) && state !== "hidden";
        const style = this.theme.vertices.states[state];
        const [r, g, b] = hexToRgb(style.color);
        const a = visible ? style.opacity : 0;
        colors.setXYZ(i, r * a, g * a, b * a);
      }
      colors.needsUpdate = true;
      return;
    }
    if (!(mesh instanceof InstancedMesh) && !layer.vertexPick) {
      return;
    }
    for (let i = 0; i < layer.vertices.size; i += 1) {
      const id = layer.vertices.getId(i)!;
      const state = resolveElementVisualState(id, sets);
      const style = this.theme.vertices.states[state];
      _color.setHex(style.color);
      if (mesh instanceof InstancedMesh) {
        mesh.setColorAt(i, _color);
      }
    }
    if (mesh instanceof InstancedMesh && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  private writeEdgeColors(
    layer: ObjectLayer,
    kernel: HalfEdgeMesh,
    sets: ElementIdSets,
    show: boolean,
  ): void {
    if (!show || !layer.edgeLines) {
      return;
    }
    const lod = planElementLod(layer.edges.size, this.display.lod.maxEdges, this.display.lod);
    const colors = layer.edgeLines.geometry.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < layer.edges.size; i += 1) {
      const id = layer.edges.getId(i)!;
      const state = resolveElementVisualState(id, sets);
      const emphasized = state !== "default";
      const visible = isLodIndexVisible(i, lod, emphasized) && state !== "hidden";
      const role = classifyEdge(kernel, id);
      const roleStyle = this.theme.edges.roles[role];
      const stateStyle = this.theme.edges.states[state];
      const color = state === "default" ? roleStyle.color : stateStyle.color;
      const opacity = visible ? (state === "default" ? roleStyle.opacity : stateStyle.opacity) : 0;
      const [r, g, b] = hexToRgb(color);
      colors.setXYZ(i * 2, r * opacity, g * opacity, b * opacity);
      colors.setXYZ(i * 2 + 1, r * opacity, g * opacity, b * opacity);
      if (layer.edgeThick) {
        _color.setRGB(r, g, b);
        layer.edgeThick.setColorAt(i, _color);
      }
    }
    colors.needsUpdate = true;
    if (layer.edgeThick?.instanceColor) {
      layer.edgeThick.instanceColor.needsUpdate = true;
    }
  }

  private writeFaces(
    layer: ObjectLayer,
    source: OverlayMeshSource,
    sets: ElementIdSets,
    show: boolean,
    domain: OverlaySelectionDomain,
  ): void {
    if (!layer.faceFill || !layer.faceOutline) {
      return;
    }
    const style = this.theme.faces.style;
    const statesOnly = this.display.showFaces === "states" || !this.display.editMode;
    let fillCount = 0;
    let colorCount = 0;
    let outlineCount = 0;
    let triangles = 0;
    const posAttr = source.geometry.getAttribute("position");
    const index = source.geometry.getIndex();
    if (!show || style === "hidden" || !posAttr) {
      this.writeGrowAttribute(layer.faceFill.geometry, "position", 3, this.fillScratch, 0);
      this.writeGrowAttribute(layer.faceOutline.geometry, "position", 3, this.outlineScratch, 0);
      layer.faceFill.userData.triangleCount = 0;
      layer.group.userData.triangleCount = 0;
      layer.group.userData.overlayKind = domain === "face" ? "face" : layer.group.userData.overlayKind;
      return;
    }
    const lod = planElementLod(layer.faces.size, this.display.lod.maxFaces, this.display.lod);
    const pushFill = (x: number, y: number, z: number, r: number, g: number, b: number): void => {
      this.fillScratch = growFloats(this.fillScratch, fillCount + 3);
      this.fillColorScratch = growFloats(this.fillColorScratch, colorCount + 3);
      this.fillScratch[fillCount] = x;
      this.fillScratch[fillCount + 1] = y;
      this.fillScratch[fillCount + 2] = z;
      this.fillColorScratch[colorCount] = r;
      this.fillColorScratch[colorCount + 1] = g;
      this.fillColorScratch[colorCount + 2] = b;
      fillCount += 3;
      colorCount += 3;
    };
    for (let tri = 0; tri < source.mapping.triangleToFace.length; tri += 1) {
      const faceId = source.mapping.triangleToFace[tri]!;
      const faceIndex = layer.faces.getIndex(faceId) ?? 0;
      const state = resolveElementVisualState(faceId, sets);
      if (state === "hidden") {
        continue;
      }
      const emphasized = state !== "default";
      if (statesOnly && !emphasized) {
        continue;
      }
      if (!isLodIndexVisible(faceIndex, lod, emphasized)) {
        continue;
      }
      const faceStyle = this.theme.faces.states[state];
      if (style === "outline") {
        continue;
      }
      const [r, g, b] = hexToRgb(faceStyle.color);
      const opacity = style === "tint" ? Math.min(0.2, faceStyle.opacity) : faceStyle.opacity;
      if (opacity <= 0 && style !== "wireframe") {
        continue;
      }
      for (let k = 0; k < 3; k += 1) {
        const vi = index ? index.getX(tri * 3 + k) : tri * 3 + k;
        pushFill(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi), r, g, b);
      }
      triangles += 1;
    }
    if (style === "outline" || style === "fill-outline" || style === "wireframe") {
      for (let i = 0; i < layer.faces.size; i += 1) {
        const id = layer.faces.getId(i)!;
        const state = resolveElementVisualState(id, sets);
        const emphasized = state !== "default";
        if (style !== "wireframe" && statesOnly && !emphasized) {
          continue;
        }
        if (state === "hidden" || !isLodIndexVisible(i, lod, emphasized)) {
          continue;
        }
        const outline = faceOutlinePositions(source.kernel, id);
        this.outlineScratch = growFloats(this.outlineScratch, outlineCount + outline.length);
        this.outlineScratch.set(outline, outlineCount);
        outlineCount += outline.length;
      }
    }
    this.writeGrowAttribute(layer.faceFill.geometry, "position", 3, this.fillScratch, fillCount);
    this.writeGrowAttribute(layer.faceFill.geometry, "color", 3, this.fillColorScratch, colorCount);
    this.writeGrowAttribute(layer.faceOutline.geometry, "position", 3, this.outlineScratch, outlineCount);
    layer.faceFill.userData.triangleCount = triangles;
    layer.group.userData.triangleCount = triangles;
    layer.group.userData.overlayKind = "face";
    layer.faceFill.visible = style !== "outline" && style !== "wireframe";
    layer.faceOutline.visible = style === "outline" || style === "fill-outline" || style === "wireframe";
  }

  private updateScreenSpace(source: OverlayMeshSource, view: VisualizerView, force = false): void {
    const layer = this.layers.get(source.objectId);
    if (!layer) {
      return;
    }
    source.object.updateWorldMatrix(true, false);
    view.camera.updateMatrixWorld();
    const viewHash = hashView(view, source.object);
    if (!force && viewHash === layer.lastViewHash) {
      this.perf.skippedViews += 1;
      return;
    }
    layer.lastViewHash = viewHash;
    view.camera.getWorldPosition(_camPos);
    const camLike = view.camera as unknown as {
      isPerspectiveCamera?: boolean;
      isOrthographicCamera?: boolean;
      fov?: number;
      zoom?: number;
      top?: number;
      bottom?: number;
    };
    const vTheme = this.theme.vertices;
    const pixel = clampPixelSize(vTheme.pixelSize, vTheme.minPixelSize, vTheme.maxPixelSize);
    const pickPad = pixel + vTheme.pickPixelPadding;
    const visual = layer.vertexMesh;
    for (let i = 0; i < layer.vertices.size; i += 1) {
      const px = layer.vertexPositions[i * 3]!;
      const py = layer.vertexPositions[i * 3 + 1]!;
      const pz = layer.vertexPositions[i * 3 + 2]!;
      _pos.set(px, py, pz).applyMatrix4(source.object.matrixWorld);
      const dist = _pos.distanceTo(_camPos);
      const world = worldSizeForPixels(camLike, dist, pixel, view.height);
      const pick = worldSizeForPixels(camLike, dist, pickPad, view.height);
      if (visual instanceof InstancedMesh) {
        _matrix.makeScale(world, world, world);
        _matrix.setPosition(px, py, pz);
        visual.setMatrixAt(i, _matrix);
      }
      if (layer.vertexPick) {
        _matrix.makeScale(pick, pick, pick);
        _matrix.setPosition(px, py, pz);
        layer.vertexPick.setMatrixAt(i, _matrix);
      }
    }
    if (visual instanceof InstancedMesh) {
      visual.instanceMatrix.needsUpdate = true;
      visual.count = layer.vertices.size;
    }
    if (visual instanceof Points) {
      const mat = visual.material as PointsMaterial;
      mat.size = pixel;
    }
    if (layer.vertexPick) {
      layer.vertexPick.instanceMatrix.needsUpdate = true;
      layer.vertexPick.count = layer.vertices.size;
    }

    if (layer.edgeThick) {
      const widthPx = this.theme.edges.width;
      for (let i = 0; i < layer.edges.size; i += 1) {
        const o = i * 6;
        _from.set(layer.edgeEndpoints[o]!, layer.edgeEndpoints[o + 1]!, layer.edgeEndpoints[o + 2]!);
        _to.set(layer.edgeEndpoints[o + 3]!, layer.edgeEndpoints[o + 4]!, layer.edgeEndpoints[o + 5]!);
        _dir.subVectors(_to, _from);
        const length = _dir.length();
        if (length < 1e-10) {
          continue;
        }
        _dir.multiplyScalar(1 / length);
        _pos.copy(_from).add(_to).multiplyScalar(0.5);
        _pos.applyMatrix4(source.object.matrixWorld);
        const dist = _pos.distanceTo(_camPos);
        const thick = worldSizeForPixels(camLike, dist, widthPx, view.height);
        _mid.copy(_from).add(_to).multiplyScalar(0.5);
        _quat.setFromUnitVectors(_xAxis, _dir);
        _scale.set(Math.max(length, 1e-6), thick, thick);
        _matrix.compose(_mid, _quat, _scale);
        layer.edgeThick.setMatrixAt(i, _matrix);
      }
      layer.edgeThick.instanceMatrix.needsUpdate = true;
      layer.edgeThick.count = layer.edges.size;
    }
  }

  private shouldShow(kind: "vertices" | "edges", domain: OverlaySelectionDomain): boolean {
    if (this.display.editMode) {
      return true;
    }
    const flag = kind === "vertices" ? this.display.showVertices : this.display.showEdges;
    if (flag === true) {
      return true;
    }
    if (flag === false) {
      return false;
    }
    return kind === "vertices" ? domain === "vertex" : domain === "edge" || domain === "object";
  }

  private vertexGeometry(style: VertexMarkerStyle): BufferGeometry {
    if (style === "custom" && this.customVertex) {
      return this.customVertex.geometry;
    }
    return style === "sphere" ? this.shared.sphere : this.shared.cube;
  }

  private vertexMaterial(layer: ObjectLayer, style: VertexMarkerStyle): Material {
    if (style === "custom" && this.customVertex) {
      return this.customVertex.material;
    }
    const xray = this.theme.vertices.xray;
    return layer.resources.trackMaterial(
      new MeshStandardMaterial({
        roughness: style === "sphere" ? 0.35 : 0.55,
        metalness: 0.05,
        transparent: true,
        depthTest: this.theme.vertices.depthTest && !xray,
        depthWrite: !xray,
      }),
    );
  }

  private makeSpriteMaterial(layer: ObjectLayer, style: "square-sprite" | "circle-sprite"): PointsMaterial {
    const texture = this.spriteTexture(style === "circle-sprite" ? "circle" : "square");
    return layer.resources.trackMaterial(
      new PointsMaterial({
        size: this.theme.vertices.pixelSize,
        sizeAttenuation: false,
        vertexColors: true,
        ...(texture ? { map: texture } : {}),
        transparent: true,
        depthTest: this.theme.vertices.depthTest && !this.theme.vertices.xray,
        alphaTest: texture ? 0.2 : 0,
      }),
    ) as PointsMaterial;
  }

  private spriteTexture(kind: "square" | "circle"): CanvasTexture | undefined {
    if (this.spriteTextures[kind]) {
      return this.spriteTextures[kind];
    }
    if (typeof document === "undefined") {
      return undefined;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return undefined;
    }
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#ffffff";
    if (kind === "circle") {
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(8, 8, 48, 48);
    }
    const texture = this.resources.trackTexture(new CanvasTexture(canvas)) as CanvasTexture;
    this.spriteTextures[kind] = texture;
    return texture;
  }

  private makeVertexPointGeometry(layer: ObjectLayer): BufferGeometry {
    const geometry = layer.resources.trackGeometry(new BufferGeometry());
    geometry.setAttribute("position", new BufferAttribute(layer.vertexPositions, 3));
    geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(layer.vertices.size * 3), 3).setUsage(DynamicDrawUsage),
    );
    return geometry;
  }

  private writeGrowAttribute(
    geometry: BufferGeometry,
    name: string,
    itemSize: number,
    source: Float32Array,
    used: number,
  ): void {
    let attribute = geometry.getAttribute(name) as BufferAttribute | undefined;
    if (!attribute || attribute.array.length < used) {
      const next = new Float32Array(Math.max(used, attribute ? attribute.array.length * 2 : 12));
      if (used > 0) {
        next.set(source.subarray(0, used));
      }
      geometry.setAttribute(name, new BufferAttribute(next, itemSize).setUsage(DynamicDrawUsage));
      attribute = geometry.getAttribute(name) as BufferAttribute;
    } else if (used > 0) {
      (attribute.array as Float32Array).set(source.subarray(0, used));
      attribute.needsUpdate = true;
    }
    geometry.setDrawRange(0, itemSize === 0 ? 0 : used / itemSize);
    if (name === "position") {
      geometry.computeBoundingSphere();
    }
  }

  private clearLayerMeshes(layer: ObjectLayer): void {
    const meshes = [layer.vertexMesh, layer.vertexPick, layer.edgeLines, layer.edgeThick, layer.faceFill, layer.faceOutline];
    for (const mesh of meshes) {
      mesh?.removeFromParent();
    }
    delete layer.vertexMesh;
    delete layer.vertexPick;
    delete layer.edgeLines;
    delete layer.edgeThick;
    delete layer.faceFill;
    delete layer.faceOutline;
  }

  private disposeLayer(layer: ObjectLayer): void {
    this.clearLayerMeshes(layer);
    layer.resources.dispose();
    layer.group.removeFromParent();
  }
}

function growFloats(buffer: Float32Array, needed: number): Float32Array {
  if (buffer.length >= needed) {
    return buffer as Float32Array;
  }
  const capacity = Math.max(needed, (buffer.length * 3) >> 1 || 32);
  const next = new Float32Array(new ArrayBuffer(capacity * 4));
  next.set(buffer);
  return next;
}

function hashView(view: VisualizerView, object: Object3D): number {
  const a = view.camera.matrixWorld.elements;
  const b = object.matrixWorld.elements;
  const scale =
    4096 *
    (view.width +
      view.height * 13 +
      a[12]! * 17 +
      a[13]! * 19 +
      a[14]! * 23 +
      a[0]! * 29 +
      a[5]! * 31 +
      a[10]! * 37 +
      b[12]! * 41 +
      b[13]! * 43 +
      b[14]! * 47 +
      b[0]! * 53 +
      b[5]! * 59 +
      b[10]! * 61);
  return scale | 0;
}
