import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  SphereGeometry,
  type Object3D,
} from "three";
import { IdIndexMap } from "./id-index";
import { CompactElementStates } from "./element-flags";
import { MeshVisualLifecycleMachine } from "./lifecycle";
import { emptyDiagnostics, type SubElementDiagnostics } from "./diagnostics";
import { GpuResourceTracker } from "./resources";
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
} from "./types";
import { buildFaceMeshes, writeFaces } from "./face-visualizer";
import { updateOverlayScreenSpace } from "./screen-space-overlay";
import {
  buildEdgeMeshes,
  fillEdgeEndpointBuffer,
  refreshEdgePositions,
  writeEdgeColorAt,
  writeEdgeColors,
} from "./edge-visualizer";
import {
  buildVertexMeshes,
  fillVertexPositionBuffer,
  refreshVertexPositions,
  writeVertexColorAt,
  writeVertexColors,
  type VertexVisualizerAssets,
} from "./vertex-visualizer";
import { clearLayerMeshes, disposeObjectLayer } from "./visualizer-lifecycle";
import type {
  ObjectLayer,
  OverlayMeshSource,
  OverlaySelection,
  OverlaySelectionDomain,
  VisualizerView,
} from "./visualizer-types";

export type { OverlayMeshSource, VisualizerView } from "./visualizer-types";

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
    // Theme updates are patches. Merging every update into the defaults made
    // unrelated changes (for example toggling topology-edge visibility) reset
    // a host's vertex marker style back to the default cube.
    this.theme = patch ? mergeSubElementTheme(this.theme, patch) : defaultSubElementTheme;
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
        const overlayLayer = this.layers.get(source.objectId);
        if (
          overlayLayer &&
          updateOverlayScreenSpace(overlayLayer, source, view, this.theme, change !== "none" || stateChanged) === "skipped"
        ) {
          this.perf.skippedViews += 1;
        }
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
        vertexScales: new Float32Array(0),
        edgeEndpoints: new Float32Array(0),
        edgeWidths: new Float32Array(0),
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
    refreshVertexPositions(layer, source);
    refreshEdgePositions(layer, source);
    layer.lastViewHash = Number.NaN;
  }

  private rebuildTopology(layer: ObjectLayer, source: OverlayMeshSource): void {
    clearLayerMeshes(layer);
    layer.resources.dispose();
    layer.vertices.rebuild(source.kernel.vertices.keys());
    layer.edges.rebuild(source.kernel.edges.keys());
    layer.faces.rebuild(source.kernel.faces.keys());
    fillVertexPositionBuffer(layer, source);
    fillEdgeEndpointBuffer(layer, source);
    layer.vertexScales = new Float32Array(layer.vertices.size).fill(1);
    layer.edgeWidths = new Float32Array(layer.edges.size).fill(this.theme.edges.width);
    buildVertexMeshes(layer, this.theme, this.vertexAssets());
    buildEdgeMeshes(layer, this.theme, this.shared.stick);
    layer.vertexStates.resize(layer.vertices.size);
    layer.edgeStates.resize(layer.edges.size);
    layer.faceStates.resize(layer.faces.size);
    buildFaceMeshes(layer, this.theme, source);
    layer.lastViewHash = Number.NaN;
    layer.presentationKey = this.presentationKey();
  }

  private vertexAssets(): VertexVisualizerAssets {
    return {
      cube: this.shared.cube,
      sphere: this.shared.sphere,
      customVertex: this.customVertex,
      spriteTextures: this.spriteTextures,
      trackRootTexture: (texture) => this.resources.trackTexture(texture) as CanvasTexture,
    };
  }

  private updateLayerState(source: OverlayMeshSource, selection: OverlaySelection): void {
    const layer = this.layers.get(source.objectId);
    if (!layer) {
      return;
    }
    const sets = this.elementSets(source.objectId, selection);
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
    writeVertexColors(layer, sets, showV, this.theme, this.display);
    writeEdgeColors(layer, source.kernel, sets, showE, this.theme, this.display);
    const buffers = {
      fillScratch: this.fillScratch,
      fillColorScratch: this.fillColorScratch,
      outlineScratch: this.outlineScratch,
    };
    writeFaces(layer, source, sets, showF, domain, this.theme, this.display, buffers);
    this.fillScratch = buffers.fillScratch;
    this.fillColorScratch = buffers.fillColorScratch;
    this.outlineScratch = buffers.outlineScratch;
  }

  private patchHoverState(source: OverlayMeshSource, selection: OverlaySelection): void {
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
        writeVertexColorAt(layer, index, sets, this.theme);
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
        writeEdgeColorAt(layer, source.kernel, index, sets, this.theme);
      }
      return;
    }
    this.updateLayerState(source, selection);
    this.perf.stateUpdates += 1;
  }

  private elementSets(objectId: ObjectId, selection: OverlaySelection): ElementIdSets {
    const selectedHere = selection.objectIds.includes(objectId);
    return {
      ...this.extraFlags,
      selected: new Set(selectedHere ? selection.elementIds : []),
      active: selectedHere ? selection.activeId : null,
      hovered: this.hover && this.hover.objectId === objectId ? this.hover.elementId : null,
    };
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

  private disposeLayer(layer: ObjectLayer): void {
    disposeObjectLayer(layer);
  }
}
