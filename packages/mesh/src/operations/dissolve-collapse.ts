import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { findEdge, repairVertexHalfEdges } from "../internal/rebuild";
import { reverseFaceLoop } from "../internal/reverse-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { cloneMesh } from "../serialize";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { mergeVertices, type MergeVerticesResult } from "./merge-vertices";

export interface DissolveVertexRequest {
  readonly vertexId: VertexId;
}

export interface DissolveVertexResult extends MeshOperationResult {
  readonly fillFaceId: FaceId | null;
}

export interface DissolveFaceRequest {
  readonly faceId: FaceId;
}

export interface DissolveFaceResult extends MeshOperationResult {
  readonly faceId: FaceId;
}

export interface CollapseEdgeRequest {
  readonly edgeId: EdgeId;
}

export type CollapseEdgeResult = MergeVerticesResult;

export interface ReverseFaceWindingRequest {
  readonly faceIds?: readonly FaceId[];
}

function otherVertex(mesh: HalfEdgeMesh, edgeId: EdgeId, vertexId: VertexId): VertexId {
  const ends = mesh.getEdgeVertices(edgeId);
  if (!ends) {
    throw new RangeError(`Edge ${edgeId} does not exist`);
  }
  if (ends[0] === vertexId) {
    return ends[1];
  }
  if (ends[1] === vertexId) {
    return ends[0];
  }
  throw new RangeError(`Vertex ${vertexId} is not on edge ${edgeId}`);
}

function neighborRing(
  mesh: HalfEdgeMesh,
  vertexId: VertexId,
): { readonly closed: boolean; readonly neighbors: VertexId[] } {
  const edges = mesh.getVertexEdges(vertexId);
  const neighbors: VertexId[] = [];
  let closed = edges.length > 0;
  for (const edgeId of edges) {
    neighbors.push(otherVertex(mesh, edgeId, vertexId));
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      closed = false;
    }
  }
  return { closed, neighbors };
}

export function dissolveVertex(
  mesh: HalfEdgeMesh,
  request: DissolveVertexRequest,
  ctx: MeshOperationContext,
): DissolveVertexResult {
  const { vertexId } = request;
  if (!mesh.vertices.has(vertexId)) {
    throw new RangeError(`Vertex ${vertexId} does not exist`);
  }
  const ring = neighborRing(mesh, vertexId);
  const unique = new Set(ring.neighbors);
  if (unique.size !== ring.neighbors.length) {
    throw new RangeError("dissolveVertex requires a simple neighbor cycle");
  }
  if (ring.closed && ring.neighbors.length < 3) {
    throw new RangeError("dissolveVertex cannot fill a cycle with fewer than 3 vertices");
  }
  const before = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  const incident = mesh.getVertexFaces(vertexId);
  for (const faceId of incident) {
    deleteFace(mesh, faceId);
  }
  for (const edgeId of [...mesh.getVertexEdges(vertexId)]) {
    const edge = mesh.edges.get(edgeId);
    if (!edge) {
      continue;
    }
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (he?.twin) {
      mesh.halfEdges.delete(he.twin);
    }
    if (he) {
      mesh.halfEdges.delete(he.id);
    }
    mesh.edges.delete(edgeId);
  }
  mesh.vertices.delete(vertexId);
  repairVertexHalfEdges(mesh);

  let fillFaceId: FaceId | null = null;
  if (ring.closed && ring.neighbors.length >= 3) {
    fillFaceId = ctx.idFactory.face();
    MeshBuilder.fromMesh(mesh).addFace(ring.neighbors, { id: fillFaceId });
  } else if (!ring.closed && ring.neighbors.length === 2) {
    const [a, b] = ring.neighbors;
    if (a && b && !findEdge(mesh, a, b)) {
      const edgeId = ctx.idFactory.edge();
      const heA = ctx.idFactory.halfEdge();
      const heB = ctx.idFactory.halfEdge();
      mesh.edges.set(edgeId, { id: edgeId, halfEdge: heA, isSeam: false });
      mesh.halfEdges.set(heA, {
        id: heA,
        edgeId,
        origin: a,
        twin: heB,
        next: heB,
        prev: heB,
        face: null,
        corner: null,
      });
      mesh.halfEdges.set(heB, {
        id: heB,
        edgeId,
        origin: b,
        twin: heA,
        next: heA,
        prev: heA,
        face: null,
        corner: null,
      });
      const va = mesh.vertices.get(a);
      const vb = mesh.vertices.get(b);
      if (va && !va.halfEdge) {
        va.halfEdge = heA;
      }
      if (vb && !vb.halfEdge) {
        vb.halfEdge = heB;
      }
    }
  }
  mapping.snapshotNewElements(before, mesh);
  repairVertexHalfEdges(mesh);
  mesh.bumpRevision();
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: fillFaceId
      ? { domain: "face", elementIds: [fillFaceId] }
      : { domain: "vertex", elementIds: ring.neighbors },
    warnings: [],
    fillFaceId,
  };
}

function regionOuterLoop(mesh: HalfEdgeMesh, region: ReadonlySet<FaceId>): VertexId[] {
  const segments: Array<{ readonly origin: VertexId; readonly dest: VertexId }> = [];
  for (const faceId of region) {
    const face = mesh.faces.get(faceId);
    if (!face) {
      continue;
    }
    let curr = face.halfEdge;
    const start = curr;
    do {
      const he = mesh.halfEdges.get(curr);
      if (!he) {
        break;
      }
      const next = mesh.halfEdges.get(he.next);
      const twin = he.twin ? mesh.halfEdges.get(he.twin) : undefined;
      const twinFace = twin?.face ?? null;
      if (!next) {
        break;
      }
      if (!twinFace || !region.has(twinFace)) {
        segments.push({ origin: he.origin, dest: next.origin });
      }
      curr = he.next;
    } while (curr !== start);
  }
  if (segments.length < 3) {
    throw new RangeError("dissolveFace region does not have a valid outer loop");
  }
  const byOrigin = new Map<VertexId, { readonly origin: VertexId; readonly dest: VertexId }>();
  for (const segment of segments) {
    if (byOrigin.has(segment.origin)) {
      throw new RangeError("dissolveFace does not support holes or non-manifold region boundaries");
    }
    byOrigin.set(segment.origin, segment);
  }
  const verts: VertexId[] = [];
  let current = segments[0]!;
  const startOrigin = current.origin;
  do {
    verts.push(current.origin);
    const next = byOrigin.get(current.dest);
    if (!next) {
      throw new RangeError("dissolveFace region boundary is not a closed loop");
    }
    current = next;
    if (verts.length > segments.length) {
      throw new RangeError("dissolveFace region boundary is not a closed loop");
    }
  } while (current.origin !== startOrigin);
  if (verts.length !== segments.length) {
    throw new RangeError("dissolveFace requires a single outer boundary loop");
  }
  return verts;
}

export function dissolveFace(
  mesh: HalfEdgeMesh,
  request: DissolveFaceRequest,
  ctx: MeshOperationContext,
): DissolveFaceResult {
  const { faceId } = request;
  if (!mesh.faces.has(faceId)) {
    throw new RangeError(`Face ${faceId} does not exist`);
  }
  const region = new Set<FaceId>([faceId, ...mesh.getAdjacentFaces(faceId)]);
  const remaining = [...mesh.faces.keys()].filter((id) => !region.has(id));
  if (remaining.length === 0) {
    throw new RangeError("dissolveFace would delete the entire mesh");
  }
  const loop = regionOuterLoop(mesh, region);
  const loopSet = new Set(loop);
  for (const id of remaining) {
    const verts = mesh.getFaceVertices(id);
    if (verts.length === loop.length && verts.every((vertexId) => loopSet.has(vertexId))) {
      throw new RangeError("dissolveFace would duplicate an existing face");
    }
  }
  const before = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  for (const id of region) {
    deleteFace(mesh, id);
  }
  const newFaceId = ctx.idFactory.face();
  MeshBuilder.fromMesh(mesh).addFace(loop, { id: newFaceId });
  mapping.snapshotNewElements(before, mesh);
  repairVertexHalfEdges(mesh);
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: { domain: "face", elementIds: [newFaceId] },
    warnings: [],
    faceId: newFaceId,
  };
}

export function collapseEdge(
  mesh: HalfEdgeMesh,
  request: CollapseEdgeRequest,
  ctx: MeshOperationContext,
): CollapseEdgeResult {
  const ends = mesh.getEdgeVertices(request.edgeId);
  if (!ends) {
    throw new RangeError(`Edge ${request.edgeId} does not exist`);
  }
  return mergeVertices(mesh, { vertexIds: ends, target: "center" }, ctx);
}

export function reverseFaceWinding(
  mesh: HalfEdgeMesh,
  request: ReverseFaceWindingRequest,
  _ctx: MeshOperationContext,
): MeshOperationResult {
  const faceIds = request.faceIds ?? [...mesh.faces.keys()];
  if (faceIds.length === 0) {
    const mapping = new TopologyMappingBuilder(mesh);
    const built = mapping.build(mesh);
    return { mesh, ...built, selection: { domain: "face", elementIds: [] }, warnings: [] };
  }
  for (const faceId of faceIds) {
    if (!mesh.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
  }
  const before = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  for (const faceId of faceIds) {
    reverseOneFace(mesh, faceId);
  }
  mapping.snapshotNewElements(before, mesh);
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: { domain: "face", elementIds: [...faceIds] },
    warnings: [],
  };
}

function reverseOneFace(mesh: HalfEdgeMesh, faceId: FaceId): void {
  reverseFaceLoop(mesh, faceId);
}
