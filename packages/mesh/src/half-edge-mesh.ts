import {
  brand,
  type VertexId,
  type EdgeId,
  type HalfEdgeId,
  type FaceId,
  type CornerId,
  type MeshId,
} from "@modeling-kit/core";
import type {
  VertexRecord,
  EdgeRecord,
  HalfEdgeRecord,
  CornerRecord,
  FaceRecord,
  MeshComponent,
} from "./types";

export class HalfEdgeMesh {
  public readonly id: MeshId;
  public readonly vertices: Map<VertexId, VertexRecord> = new Map();
  public readonly edges: Map<EdgeId, EdgeRecord> = new Map();
  public readonly halfEdges: Map<HalfEdgeId, HalfEdgeRecord> = new Map();
  public readonly corners: Map<CornerId, CornerRecord> = new Map();
  public readonly faces: Map<FaceId, FaceRecord> = new Map();
  private _revision: number = 0;
  private _topologyRevision: number = 0;
  private _positionsRevision: number = 0;
  private _normalsRevision: number = 0;
  private _uvRevision: number = 0;
  private _seamRevision: number = 0;
  private _pinRevision: number = 0;
  private _materialsRevision: number = 0;

  constructor(id: MeshId = brand("mesh-default")) {
    this.id = id;
  }

  get revision(): number {
    return this._revision;
  }

  get topologyRevision(): number {
    return this._topologyRevision;
  }

  get positionsRevision(): number {
    return this._positionsRevision;
  }

  get normalsRevision(): number {
    return this._normalsRevision;
  }

  get uvRevision(): number {
    return this._uvRevision;
  }

  get seamRevision(): number {
    return this._seamRevision;
  }

  get pinRevision(): number {
    return this._pinRevision;
  }

  get materialsRevision(): number {
    return this._materialsRevision;
  }

  bumpRevision(): void {
    this._revision++;
    this._topologyRevision++;
  }

  bumpPositionsRevision(): void {
    this._revision++;
    this._positionsRevision++;
  }

  bumpNormalsRevision(): void {
    this._revision++;
    this._normalsRevision++;
  }

  bumpUvRevision(): void {
    this._revision++;
    this._uvRevision++;
  }

  bumpSeamRevision(): void {
    this._revision++;
    this._seamRevision++;
  }

  bumpPinRevision(): void {
    this._revision++;
    this._pinRevision++;
  }

  bumpMaterialsRevision(): void {
    this._revision++;
    this._materialsRevision++;
  }

  setRevision(value: number): void {
    this._revision = value;
  }

  setRevisions(values: {
    revision?: number;
    topology?: number;
    positions?: number;
    normals?: number;
    uv?: number;
    seams?: number;
    pins?: number;
    materials?: number;
  }): void {
    if (values.revision !== undefined) {
      this._revision = values.revision;
    }
    if (values.topology !== undefined) {
      this._topologyRevision = values.topology;
    }
    if (values.positions !== undefined) {
      this._positionsRevision = values.positions;
    }
    if (values.normals !== undefined) {
      this._normalsRevision = values.normals;
    }
    if (values.uv !== undefined) {
      this._uvRevision = values.uv;
    }
    if (values.seams !== undefined) {
      this._seamRevision = values.seams;
    }
    if (values.pins !== undefined) {
      this._pinRevision = values.pins;
    }
    if (values.materials !== undefined) {
      this._materialsRevision = values.materials;
    }
  }

  // --- Topological Adjacency Queries ---

  private walkBudget(): number {
    return this.halfEdges.size + 2;
  }

  /** All half-edges leaving a vertex. Scans the map so boundary stars are complete. */
  getOutgoingHalfEdges(vId: VertexId): HalfEdgeId[] {
    if (!this.vertices.has(vId)) {
      return [];
    }
    const ids: HalfEdgeId[] = [];
    for (const [heId, he] of this.halfEdges) {
      if (he.origin === vId) {
        ids.push(heId);
      }
    }
    return ids;
  }

  getVertexEdges(vId: VertexId): EdgeId[] {
    if (!this.vertices.has(vId)) {
      return [];
    }
    const edges = new Set<EdgeId>();
    for (const he of this.halfEdges.values()) {
      if (he.origin === vId) {
        edges.add(he.edgeId);
        continue;
      }
      const next = this.halfEdges.get(he.next);
      if (next?.origin === vId) {
        edges.add(he.edgeId);
      }
    }
    return [...edges];
  }

  getVertexFaces(vId: VertexId): FaceId[] {
    const faces = new Set<FaceId>();
    for (const heId of this.getOutgoingHalfEdges(vId)) {
      const he = this.halfEdges.get(heId);
      if (he?.face) {
        faces.add(he.face);
      }
    }
    return [...faces];
  }

  getEdgeFaces(eId: EdgeId): [FaceId | null, FaceId | null] {
    const edge = this.edges.get(eId);
    if (!edge) return [null, null];

    const he1 = this.halfEdges.get(edge.halfEdge);
    if (!he1) return [null, null];

    const f1 = he1.face ?? null;
    if (!he1.twin) return [f1, null];

    const he2 = this.halfEdges.get(he1.twin);
    const f2 = he2?.face ?? null;

    return [f1, f2];
  }

  getEdgeVertices(eId: EdgeId): [VertexId, VertexId] | null {
    const edge = this.edges.get(eId);
    if (!edge) return null;
    const he = this.halfEdges.get(edge.halfEdge);
    if (!he) return null;
    const next = this.halfEdges.get(he.next);
    if (!next) return null;
    return [he.origin, next.origin];
  }

  getFaceEdges(fId: FaceId): EdgeId[] {
    return this.walkFace(fId, (he) => he.edgeId);
  }

  getFaceVertices(fId: FaceId): VertexId[] {
    return this.walkFace(fId, (he) => he.origin);
  }

  getFaceCorners(fId: FaceId): CornerId[] {
    const corners: CornerId[] = [];
    this.walkFace(fId, (he) => {
      if (he.corner) {
        corners.push(he.corner);
      }
      return he.edgeId;
    });
    return corners;
  }

  private walkFace<T>(fId: FaceId, pick: (he: HalfEdgeRecord) => T): T[] {
    const face = this.faces.get(fId);
    if (!face) {
      return [];
    }
    const out: T[] = [];
    const start = face.halfEdge;
    let curr = start;
    const budget = this.walkBudget();
    while (curr && out.length < budget) {
      const he = this.halfEdges.get(curr);
      if (!he) {
        break;
      }
      out.push(pick(he));
      curr = he.next;
      if (curr === start) {
        break;
      }
    }
    return out;
  }

  /** Vertices and corners of a face in one half-edge walk. */
  collectFaceLoop(fId: FaceId): { vertexIds: VertexId[]; cornerIds: CornerId[] } {
    const vertexIds: VertexId[] = [];
    const cornerIds: CornerId[] = [];
    const face = this.faces.get(fId);
    if (!face) {
      return { vertexIds, cornerIds };
    }
    const start = face.halfEdge;
    let curr = start;
    const budget = this.walkBudget();
    while (curr && vertexIds.length < budget) {
      const he = this.halfEdges.get(curr);
      if (!he) {
        break;
      }
      vertexIds.push(he.origin);
      if (he.corner) {
        cornerIds.push(he.corner);
      }
      curr = he.next;
      if (curr === start) {
        break;
      }
    }
    return { vertexIds, cornerIds };
  }

  getCornerLoop(cId: CornerId): { next: CornerId | null; prev: CornerId | null } {
    for (const he of this.halfEdges.values()) {
      if (he.corner !== cId) {
        continue;
      }
      const next = this.halfEdges.get(he.next);
      const prev = this.halfEdges.get(he.prev);
      return { next: next?.corner ?? null, prev: prev?.corner ?? null };
    }
    return { next: null, prev: null };
  }

  getAdjacentFaces(fId: FaceId): FaceId[] {
    const edges = this.getFaceEdges(fId);
    const adjacent = new Set<FaceId>();

    for (const eId of edges) {
      const [f1, f2] = this.getEdgeFaces(eId);
      if (f1 && f1 !== fId) adjacent.add(f1);
      if (f2 && f2 !== fId) adjacent.add(f2);
    }

    return Array.from(adjacent);
  }

  findBoundaryEdges(): EdgeId[] {
    const boundaries: EdgeId[] = [];
    for (const [eId, edge] of this.edges) {
      const he = this.halfEdges.get(edge.halfEdge);
      if (!he || !he.twin) {
        boundaries.push(eId);
        continue;
      }
      const twin = this.halfEdges.get(he.twin);
      if (!he.face || !twin?.face) {
        boundaries.push(eId);
      }
    }
    return boundaries;
  }

  findConnectedComponents(): MeshComponent[] {
    const visitedFaces = new Set<FaceId>();
    const components: MeshComponent[] = [];

    for (const [fId] of this.faces) {
      if (visitedFaces.has(fId)) continue;

      const compFaces: FaceId[] = [];
      const compVertices = new Set<VertexId>();
      const queue: FaceId[] = [fId];
      visitedFaces.add(fId);
      let qi = 0;

      while (qi < queue.length && queue.length <= this.faces.size) {
        const currFId = queue[qi]!;
        qi += 1;
        compFaces.push(currFId);
        for (const vId of this.getFaceVertices(currFId)) {
          compVertices.add(vId);
        }

        for (const neighbor of this.getAdjacentFaces(currFId)) {
          if (!visitedFaces.has(neighbor)) {
            visitedFaces.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      components.push({
        vertexIds: Array.from(compVertices),
        faceIds: compFaces,
      });
    }

    return components;
  }

  findEdgeLoops(startEdgeId: EdgeId): EdgeId[] {
    // Edge loop traversal along quad topology
    const result: EdgeId[] = [startEdgeId];
    // Implementation traverses opposing edges in quad faces
    const edge = this.edges.get(startEdgeId);
    if (!edge) return result;

    const traverseDir = (startHeId: HalfEdgeId) => {
      let currHe = this.halfEdges.get(startHeId);
      let steps = 0;
      const limit = this.edges.size + 2;
      while (currHe && currHe.face && steps < limit) {
        steps += 1;
        const faceVertices = this.getFaceVertices(currHe.face);
        if (faceVertices.length !== 4) break; // Quad topology only

        // Opposing half-edge in quad is next.next
        const next1 = this.halfEdges.get(currHe.next);
        if (!next1) break;
        const opp = this.halfEdges.get(next1.next);
        if (!opp) break;

        result.push(opp.edgeId);

        if (!opp.twin) break;
        currHe = this.halfEdges.get(opp.twin);
        if (currHe?.edgeId === startEdgeId) break; // Avoid infinite loops
      }
    };

    const he = this.halfEdges.get(edge.halfEdge);
    if (he) traverseDir(he.id);

    return Array.from(new Set(result));
  }

  findEdgeRings(startEdgeId: EdgeId): EdgeId[] {
    // Edge ring traversal parallel across quad faces
    const result: EdgeId[] = [startEdgeId];
    const edge = this.edges.get(startEdgeId);
    if (!edge) return result;

    const traverseDir = (startHeId: HalfEdgeId) => {
      let currHe = this.halfEdges.get(startHeId);
      let steps = 0;
      const limit = this.edges.size + 2;
      while (currHe && currHe.face && steps < limit) {
        steps += 1;
        const faceVertices = this.getFaceVertices(currHe.face);
        if (faceVertices.length !== 4) break;

        const nextHe = this.halfEdges.get(currHe.next);
        if (!nextHe || !nextHe.twin) break;

        result.push(nextHe.edgeId);
        currHe = this.halfEdges.get(nextHe.twin);
        if (currHe?.edgeId === startEdgeId) break;
      }
    };

    const he = this.halfEdges.get(edge.halfEdge);
    if (he) traverseDir(he.id);

    return Array.from(new Set(result));
  }
}
