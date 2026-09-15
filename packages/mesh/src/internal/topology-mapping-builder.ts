import type { CornerId, EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import type {
  ElementMapping,
  MeshChangeSet,
  TopologyMapping,
} from "../operations/contract";

class ElementLifecycle<TId> {
  readonly preserved = new Set<TId>();
  readonly deleted = new Set<TId>();
  readonly created = new Set<TId>();
  readonly replacedBy = new Map<TId, TId[]>();
  readonly derivedFrom = new Map<TId, TId[]>();

  constructor(existing: Iterable<TId>) {
    for (const id of existing) {
      this.preserved.add(id);
    }
  }

  delete(id: TId): void {
    this.preserved.delete(id);
    if (!this.created.has(id)) {
      this.deleted.add(id);
    } else {
      this.created.delete(id);
      this.derivedFrom.delete(id);
    }
  }

  create(id: TId, from?: readonly TId[]): void {
    this.created.add(id);
    this.preserved.delete(id);
    if (from && from.length > 0) {
      this.derivedFrom.set(id, [...from]);
    }
  }

  replace(oldId: TId, newIds: readonly TId[]): void {
    if (!newIds.includes(oldId)) {
      this.delete(oldId);
    }
    this.replacedBy.set(oldId, [...newIds]);
    for (const next of newIds) {
      const existing = this.derivedFrom.get(next) ?? [];
      if (!existing.includes(oldId)) {
        this.derivedFrom.set(next, [...existing, oldId]);
      }
    }
  }

  freeze(): ElementMapping<TId> {
    return {
      preserved: new Set(this.preserved),
      deleted: new Set(this.deleted),
      created: new Set(this.created),
      replacedBy: new Map(this.replacedBy),
      derivedFrom: new Map(this.derivedFrom),
    };
  }
}

export class TopologyMappingBuilder {
  private readonly vertices: ElementLifecycle<VertexId>;
  private readonly edges: ElementLifecycle<EdgeId>;
  private readonly faces: ElementLifecycle<FaceId>;
  private readonly corners: ElementLifecycle<CornerId>;
  private readonly startVertices: number;
  private readonly startEdges: number;
  private readonly startFaces: number;
  private readonly startCorners: number;

  constructor(mesh: HalfEdgeMesh) {
    this.vertices = new ElementLifecycle(mesh.vertices.keys());
    this.edges = new ElementLifecycle(mesh.edges.keys());
    this.faces = new ElementLifecycle(mesh.faces.keys());
    this.corners = new ElementLifecycle(mesh.corners.keys());
    this.startVertices = mesh.vertices.size;
    this.startEdges = mesh.edges.size;
    this.startFaces = mesh.faces.size;
    this.startCorners = mesh.corners.size;
  }

  deleteVertex(id: VertexId): void {
    this.vertices.delete(id);
  }

  createVertex(id: VertexId, from?: readonly VertexId[]): void {
    this.vertices.create(id, from);
  }

  replaceVertex(oldId: VertexId, newIds: readonly VertexId[]): void {
    this.vertices.replace(oldId, newIds);
  }

  deleteEdge(id: EdgeId): void {
    this.edges.delete(id);
  }

  createEdge(id: EdgeId, from?: readonly EdgeId[]): void {
    this.edges.create(id, from);
  }

  replaceEdge(oldId: EdgeId, newIds: readonly EdgeId[]): void {
    this.edges.replace(oldId, newIds);
  }

  deleteFace(id: FaceId): void {
    this.faces.delete(id);
  }

  createFace(id: FaceId, from?: readonly FaceId[]): void {
    this.faces.create(id, from);
  }

  replaceFace(oldId: FaceId, newIds: readonly FaceId[]): void {
    this.faces.replace(oldId, newIds);
  }

  deleteCorner(id: CornerId): void {
    this.corners.delete(id);
  }

  createCorner(id: CornerId, from?: readonly CornerId[]): void {
    this.corners.create(id, from);
  }

  replaceCorner(oldId: CornerId, newIds: readonly CornerId[]): void {
    this.corners.replace(oldId, newIds);
  }

  recordFaceRebuild(mesh: HalfEdgeMesh, faceId: FaceId, previousCornerIds: readonly CornerId[]): void {
    for (const cornerId of previousCornerIds) {
      this.deleteCorner(cornerId);
    }
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      this.createCorner(cornerId, previousCornerIds);
    }
  }

  snapshotNewElements(before: HalfEdgeMesh, after: HalfEdgeMesh): void {
    for (const id of after.vertices.keys()) {
      if (!before.vertices.has(id) && !this.vertices.created.has(id)) {
        this.createVertex(id);
      }
    }
    for (const id of after.edges.keys()) {
      if (!before.edges.has(id) && !this.edges.created.has(id)) {
        this.createEdge(id);
      }
    }
    for (const id of after.faces.keys()) {
      if (!before.faces.has(id) && !this.faces.created.has(id)) {
        this.createFace(id);
      }
    }
    for (const id of after.corners.keys()) {
      if (!before.corners.has(id) && !this.corners.created.has(id)) {
        this.createCorner(id);
      }
    }
    for (const id of before.vertices.keys()) {
      if (!after.vertices.has(id) && !this.vertices.deleted.has(id)) {
        this.deleteVertex(id);
      }
    }
    for (const id of before.edges.keys()) {
      if (!after.edges.has(id) && !this.edges.deleted.has(id)) {
        this.deleteEdge(id);
      }
    }
    for (const id of before.faces.keys()) {
      if (!after.faces.has(id) && !this.faces.deleted.has(id)) {
        this.deleteFace(id);
      }
    }
    for (const id of before.corners.keys()) {
      if (!after.corners.has(id) && !this.corners.deleted.has(id)) {
        this.deleteCorner(id);
      }
    }
  }

  build(mesh: HalfEdgeMesh): { mapping: TopologyMapping; changes: MeshChangeSet } {
    return {
      mapping: {
        vertices: this.vertices.freeze(),
        edges: this.edges.freeze(),
        faces: this.faces.freeze(),
        corners: this.corners.freeze(),
      },
      changes: {
        vertexCountDelta: mesh.vertices.size - this.startVertices,
        edgeCountDelta: mesh.edges.size - this.startEdges,
        faceCountDelta: mesh.faces.size - this.startFaces,
        cornerCountDelta: mesh.corners.size - this.startCorners,
      },
    };
  }
}
