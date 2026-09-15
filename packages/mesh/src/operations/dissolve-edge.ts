import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface DissolveEdgeRequest {
  readonly edgeId: EdgeId;
}

export interface DissolveEdgeResult extends MeshOperationResult {
  readonly faceId: FaceId;
  readonly dissolvedEdgeId: EdgeId;
}

export function dissolveEdge(
  mesh: HalfEdgeMesh,
  request: DissolveEdgeRequest,
  ctx: MeshOperationContext,
): DissolveEdgeResult {
  return runTransactionalMeshOp(mesh, () => dissolveEdgeUnlocked(mesh, request, ctx));
}

function dissolveEdgeUnlocked(
  mesh: HalfEdgeMesh,
  request: DissolveEdgeRequest,
  ctx: MeshOperationContext,
): DissolveEdgeResult {
  const { edgeId } = request;
  if (!mesh.edges.has(edgeId)) {
    throw new RangeError(`Edge ${edgeId} does not exist`);
  }
  const [f1, f2] = mesh.getEdgeFaces(edgeId);
  const ends = mesh.getEdgeVertices(edgeId);
  if (!f1 || !f2 || !ends) {
    throw new RangeError(`Edge ${edgeId} is not a manifold interior edge`);
  }
  const faceA = mesh.faces.get(f1)!;
  const faceB = mesh.faces.get(f2)!;
  if (ctx.validation === "strict" && faceA.materialSlot !== faceB.materialSlot) {
    throw new RangeError("dissolveEdge requires compatible material slots");
  }
  const loop1 = mesh.getFaceVertices(f1);
  const loop2 = mesh.getFaceVertices(f2);
  const [a, b] = ends;
  const boundary = combinedBoundary(loop1, loop2, a, b);
  const unique = new Set(boundary);
  if (boundary.length < 3 || unique.size !== boundary.length) {
    throw new RangeError("Dissolving this edge would create a degenerate face");
  }

  const mapping = new TopologyMappingBuilder(mesh);
  const keepFaceId = lowestCornerFace(mesh, f1, f2);
  const dropFaceId = keepFaceId === f1 ? f2 : f1;
  const slot = mesh.faces.get(keepFaceId)?.materialSlot ?? faceA.materialSlot;
  const smooth = mesh.faces.get(keepFaceId)?.isSmooth ?? faceA.isSmooth;

  deleteFace(mesh, f1);
  deleteFace(mesh, f2);
  mapping.deleteFace(dropFaceId);
  mapping.replaceFace(dropFaceId, [keepFaceId]);
  mapping.deleteEdge(edgeId);

  const builder = MeshBuilder.fromMesh(mesh);
  builder.addFace(boundary, {
    id: keepFaceId,
    materialSlot: slot,
    isSmooth: smooth,
  });

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: [keepFaceId] },
    warnings: [],
    faceId: keepFaceId,
    dissolvedEdgeId: edgeId,
  };
}

export function dissolveEdges(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  ctx: MeshOperationContext,
): { faceIds: FaceId[]; dissolved: EdgeId[] } {
  if (edgeIds.length === 0) {
    throw new RangeError("dissolveEdges requires at least one edge");
  }
  const dissolved: EdgeId[] = [];
  const faceIds: FaceId[] = [];
  for (const edgeId of edgeIds) {
    if (!mesh.edges.has(edgeId)) {
      continue;
    }
    const result = dissolveEdge(mesh, { edgeId }, ctx);
    faceIds.push(result.faceId);
    dissolved.push(result.dissolvedEdgeId);
  }
  return { faceIds, dissolved };
}

function lowestCornerFace(mesh: HalfEdgeMesh, a: FaceId, b: FaceId): FaceId {
  const cornersA = mesh.getFaceCorners(a);
  const cornersB = mesh.getFaceCorners(b);
  const minA = minId(cornersA);
  const minB = minId(cornersB);
  return minA <= minB ? a : b;
}

function minId(ids: readonly string[]): string {
  let min = ids[0]!;
  for (const id of ids) {
    if (id < min) {
      min = id;
    }
  }
  return min;
}

function combinedBoundary(
  loopA: readonly VertexId[],
  loopB: readonly VertexId[],
  a: VertexId,
  b: VertexId,
): VertexId[] {
  const pathA = walkExclusive(loopA, b, a);
  const pathB = walkExclusive(loopB, a, b);
  return [b, ...pathA, a, ...pathB];
}

function walkExclusive(loop: readonly VertexId[], from: VertexId, until: VertexId): VertexId[] {
  const start = loop.indexOf(from);
  if (start < 0) {
    throw new RangeError("Shared edge vertices are not on the face loop");
  }
  const path: VertexId[] = [];
  for (let step = 1; step < loop.length; step++) {
    const id = loop[(start + step) % loop.length]!;
    if (id === until) {
      break;
    }
    path.push(id);
  }
  return path;
}
