import type {
  FaceId,
  UVEdgeId,
  UVFaceId,
  UVIslandId,
  UVVertexId,
  VertexId,
} from "@modeling-kit/core";
import type { UVTopology } from "./topology";

export type UVSelectionMode = "vertex" | "edge" | "face" | "island";
export type UVSelectionOperation = "replace" | "add" | "remove" | "toggle";

export type UVElementId = UVVertexId | UVEdgeId | UVFaceId | UVIslandId;

export interface UVSelectionHit {
  readonly mode: UVSelectionMode;
  readonly id: UVElementId;
}

export interface UVSelectionState {
  readonly mode: UVSelectionMode;
  readonly ids: readonly UVElementId[];
  readonly activeId: UVElementId | null;
  readonly revision: number;
}

export interface UVSelectionSync {
  readonly enabled: boolean;
  readonly onFacesSelected?: ((faceIds: readonly FaceId[], activeFaceId: FaceId | null) => void) | undefined;
}

export class UVSelection {
  mode: UVSelectionMode = "vertex";
  private ids = new Set<string>();
  activeId: UVElementId | null = null;
  revision = 0;
  private syncing = false;

  constructor(private readonly sync: UVSelectionSync = { enabled: false }) {}

  snapshot(): UVSelectionState {
    return {
      mode: this.mode,
      ids: [...this.ids] as UVElementId[],
      activeId: this.activeId,
      revision: this.revision,
    };
  }

  apply(
    topology: UVTopology,
    request: {
      readonly mode: UVSelectionMode;
      readonly operation: UVSelectionOperation;
      readonly ids: readonly UVElementId[];
    },
  ): UVSelectionState {
    this.mode = request.mode;
    const incoming = request.ids.filter((id) => this.exists(topology, request.mode, id));
    if (request.operation === "replace") {
      this.ids = new Set(incoming);
      this.activeId = incoming[incoming.length - 1] ?? null;
    } else if (request.operation === "add") {
      for (const id of incoming) {
        this.ids.add(id);
      }
      this.activeId = incoming[incoming.length - 1] ?? this.activeId;
    } else if (request.operation === "remove") {
      for (const id of incoming) {
        this.ids.delete(id);
      }
      if (this.activeId && !this.ids.has(this.activeId)) {
        this.activeId = (this.ids.values().next().value as UVElementId | undefined) ?? null;
      }
    } else {
      for (const id of incoming) {
        if (this.ids.has(id)) {
          this.ids.delete(id);
        } else {
          this.ids.add(id);
        }
      }
      this.activeId = incoming[incoming.length - 1] ?? this.activeId;
      if (this.activeId && !this.ids.has(this.activeId)) {
        this.activeId = (this.ids.values().next().value as UVElementId | undefined) ?? null;
      }
    }
    this.bump();
    this.emitFaceSync(topology);
    return this.snapshot();
  }

  selectAll(topology: UVTopology, mode: UVSelectionMode = this.mode): UVSelectionState {
    this.mode = mode;
    this.ids = new Set(this.allIds(topology, mode));
    this.activeId = (this.ids.values().next().value as UVElementId | undefined) ?? null;
    this.bump();
    this.emitFaceSync(topology);
    return this.snapshot();
  }

  clear(): UVSelectionState {
    this.ids.clear();
    this.activeId = null;
    this.bump();
    return this.snapshot();
  }

  invert(topology: UVTopology): UVSelectionState {
    const all = this.allIds(topology, this.mode);
    const next = new Set<string>();
    for (const id of all) {
      if (!this.ids.has(id)) {
        next.add(id);
      }
    }
    this.ids = next;
    this.activeId = (this.ids.values().next().value as UVElementId | undefined) ?? null;
    this.bump();
    this.emitFaceSync(topology);
    return this.snapshot();
  }

  selectIsland(topology: UVTopology, islandId: UVIslandId): UVSelectionState {
    const island = topology.islands.get(islandId);
    if (!island) {
      return this.snapshot();
    }
    if (this.mode === "island") {
      return this.apply(topology, { mode: "island", operation: "replace", ids: [islandId] });
    }
    if (this.mode === "face") {
      return this.apply(topology, { mode: "face", operation: "replace", ids: island.uvFaceIds });
    }
    if (this.mode === "vertex") {
      return this.apply(topology, { mode: "vertex", operation: "replace", ids: island.vertexIds });
    }
    const edgeIds = island.uvFaceIds.flatMap((id) => topology.faces.get(id)?.edgeIds ?? []);
    return this.apply(topology, { mode: "edge", operation: "replace", ids: edgeIds });
  }

  selectLinked(topology: UVTopology): UVSelectionState {
    const seed = this.activeId ?? ([...this.ids][0] as UVElementId | undefined);
    if (!seed) {
      return this.snapshot();
    }
    const islandId = this.islandOf(topology, seed);
    if (!islandId) {
      return this.snapshot();
    }
    return this.selectIsland(topology, islandId);
  }

  grow(topology: UVTopology): UVSelectionState {
    if (this.mode === "island") {
      return this.snapshot();
    }
    const extra: UVElementId[] = [];
    if (this.mode === "vertex") {
      for (const edge of topology.edges.values()) {
        if (this.ids.has(edge.a) || this.ids.has(edge.b)) {
          extra.push(edge.a, edge.b);
        }
      }
    } else if (this.mode === "edge") {
      for (const face of topology.faces.values()) {
        if (face.edgeIds.some((id) => this.ids.has(id))) {
          extra.push(...face.edgeIds);
        }
      }
    } else {
      for (const face of topology.faces.values()) {
        if (this.ids.has(face.id)) {
          continue;
        }
        const neighbor = [...topology.faces.values()].some(
          (other) =>
            this.ids.has(other.id) && other.edgeIds.some((edgeId) => face.edgeIds.includes(edgeId)),
        );
        if (neighbor) {
          extra.push(face.id);
        }
      }
    }
    return this.apply(topology, { mode: this.mode, operation: "add", ids: extra });
  }

  shrink(topology: UVTopology): UVSelectionState {
    if (this.ids.size === 0) {
      return this.snapshot();
    }
    const drop: UVElementId[] = [];
    if (this.mode === "vertex") {
      for (const id of this.ids) {
        const boundary = [...topology.edges.values()].some(
          (edge) =>
            (edge.a === id && !this.ids.has(edge.b)) || (edge.b === id && !this.ids.has(edge.a)),
        );
        if (boundary) {
          drop.push(id as UVVertexId);
        }
      }
    } else if (this.mode === "face") {
      for (const id of this.ids) {
        const face = topology.faces.get(id as UVFaceId);
        if (!face) {
          continue;
        }
        const onBoundary = [...topology.faces.values()].some(
          (other) =>
            !this.ids.has(other.id) && other.edgeIds.some((edgeId) => face.edgeIds.includes(edgeId)),
        );
        if (onBoundary) {
          drop.push(id as UVFaceId);
        }
      }
    } else if (this.mode === "edge") {
      for (const id of this.ids) {
        const edge = topology.edges.get(id as UVEdgeId);
        if (!edge) {
          continue;
        }
        if (!this.ids.has(edge.a) || !this.ids.has(edge.b)) {
          drop.push(id as UVEdgeId);
        }
      }
    }
    return this.apply(topology, { mode: this.mode, operation: "remove", ids: drop });
  }

  selectFrom3DFaces(topology: UVTopology, faceIds: readonly FaceId[]): UVSelectionState {
    if (this.syncing) {
      return this.snapshot();
    }
    this.syncing = true;
    try {
      this.mode = "face";
      const ids = faceIds
        .map((faceId) => topology.faceToUVFace.get(faceId))
        .filter((id): id is UVFaceId => Boolean(id));
      this.ids = new Set(ids);
      this.activeId = ids[0] ?? null;
      this.bump();
      return this.snapshot();
    } finally {
      this.syncing = false;
    }
  }

  selectedFaceIds(topology: UVTopology): FaceId[] {
    if (this.mode === "face") {
      return [...this.ids]
        .map((id) => topology.faces.get(id as UVFaceId)?.faceId)
        .filter((id): id is FaceId => Boolean(id));
    }
    if (this.mode === "island") {
      return [...this.ids].flatMap((id) => [...(topology.islands.get(id as UVIslandId)?.faceIds ?? [])]);
    }
    if (this.mode === "vertex") {
      const faces: FaceId[] = [];
      for (const face of topology.faces.values()) {
        if (face.vertexIds.some((id) => this.ids.has(id))) {
          faces.push(face.faceId);
        }
      }
      return faces;
    }
    const faces: FaceId[] = [];
    for (const face of topology.faces.values()) {
      if (face.edgeIds.some((id) => this.ids.has(id))) {
        faces.push(face.faceId);
      }
    }
    return faces;
  }

  selectedCornerIds(topology: UVTopology): import("@modeling-kit/core").CornerId[] {
    const corners = new Set<import("@modeling-kit/core").CornerId>();
    if (this.mode === "vertex") {
      for (const id of this.ids) {
        const vertex = topology.vertices.get(id as UVVertexId);
        vertex?.cornerIds.forEach((cornerId) => corners.add(cornerId));
      }
    } else if (this.mode === "edge") {
      for (const id of this.ids) {
        const edge = topology.edges.get(id as UVEdgeId);
        if (!edge) {
          continue;
        }
        topology.vertices.get(edge.a)?.cornerIds.forEach((cornerId) => corners.add(cornerId));
        topology.vertices.get(edge.b)?.cornerIds.forEach((cornerId) => corners.add(cornerId));
      }
    } else if (this.mode === "face") {
      for (const id of this.ids) {
        const face = topology.faces.get(id as UVFaceId);
        face?.vertexIds.forEach((vertexId) => {
          topology.vertices.get(vertexId)?.cornerIds.forEach((cornerId) => corners.add(cornerId));
        });
      }
    } else {
      for (const id of this.ids) {
        const island = topology.islands.get(id as UVIslandId);
        island?.cornerIds.forEach((cornerId) => corners.add(cornerId));
      }
    }
    return [...corners];
  }

  expandSticky(
    topology: UVTopology,
    kind: "shared-vertex" | "uv-location",
  ): UVSelectionState {
    if (this.mode !== "vertex") {
      return this.snapshot();
    }
    const extra: UVVertexId[] = [];
    for (const id of this.ids) {
      const vertex = topology.vertices.get(id as UVVertexId);
      if (!vertex) {
        continue;
      }
      for (const other of topology.vertices.values()) {
        if (kind === "shared-vertex" && other.spatialVertexId === vertex.spatialVertexId) {
          extra.push(other.id);
        }
        if (
          kind === "uv-location" &&
          Math.abs(other.u - vertex.u) < 1e-7 &&
          Math.abs(other.v - vertex.v) < 1e-7
        ) {
          extra.push(other.id);
        }
      }
    }
    return this.apply(topology, { mode: "vertex", operation: "add", ids: extra });
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  spatialVertexIds(topology: UVTopology): VertexId[] {
    return this.selectedCornerIds(topology)
      .map((id) => {
        for (const vertex of topology.vertices.values()) {
          if (vertex.cornerIds.includes(id)) {
            return vertex.spatialVertexId;
          }
        }
        return undefined;
      })
      .filter((id): id is VertexId => Boolean(id));
  }

  private exists(topology: UVTopology, mode: UVSelectionMode, id: string): boolean {
    if (mode === "vertex") {
      return topology.vertices.has(id as UVVertexId);
    }
    if (mode === "edge") {
      return topology.edges.has(id as UVEdgeId);
    }
    if (mode === "face") {
      return topology.faces.has(id as UVFaceId);
    }
    return topology.islands.has(id as UVIslandId);
  }

  private allIds(topology: UVTopology, mode: UVSelectionMode): UVElementId[] {
    if (mode === "vertex") {
      return [...topology.vertices.keys()];
    }
    if (mode === "edge") {
      return [...topology.edges.keys()];
    }
    if (mode === "face") {
      return [...topology.faces.keys()];
    }
    return [...topology.islands.keys()];
  }

  private islandOf(topology: UVTopology, id: UVElementId): UVIslandId | undefined {
    if (topology.islands.has(id as UVIslandId)) {
      return id as UVIslandId;
    }
    const face = topology.faces.get(id as UVFaceId);
    if (face) {
      return face.islandId;
    }
    const vertex = topology.vertices.get(id as UVVertexId);
    if (vertex) {
      for (const island of topology.islands.values()) {
        if (island.vertexIds.includes(vertex.id)) {
          return island.id;
        }
      }
    }
    const edge = topology.edges.get(id as UVEdgeId);
    if (edge) {
      for (const uvFace of topology.faces.values()) {
        if (uvFace.edgeIds.includes(edge.id)) {
          return uvFace.islandId;
        }
      }
    }
    return undefined;
  }

  private emitFaceSync(topology: UVTopology): void {
    if (!this.sync.enabled || this.syncing) {
      return;
    }
    this.syncing = true;
    try {
      const faces = this.selectedFaceIds(topology);
      const active =
        this.activeId && topology.faces.has(this.activeId as UVFaceId)
          ? topology.faces.get(this.activeId as UVFaceId)?.faceId ?? null
          : (faces[0] ?? null);
      this.sync.onFacesSelected?.(faces, active);
    } finally {
      this.syncing = false;
    }
  }

  private bump(): void {
    this.revision += 1;
  }
}
