import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { CREASE_EPSILON } from "../creases/types";
import { isCreaseEdge } from "./edge-points";
import type { Vec3 } from "./types";
import { averageVec, clonePoint, lerpPoint } from "./vec";

export function smoothVertexPoint(
  position: readonly number[],
  facePoints: readonly Vec3[],
  edgeMidpoints: readonly Vec3[],
): Vec3 {
  const n = edgeMidpoints.length;
  if (n === 0) {
    return clonePoint(position);
  }
  const Q = averageVec(facePoints);
  const R = averageVec(edgeMidpoints);
  const s = n - 3;
  return [
    (Q[0] + 2 * R[0] + s * position[0]!) / n,
    (Q[1] + 2 * R[1] + s * position[1]!) / n,
    (Q[2] + 2 * R[2] + s * position[2]!) / n,
  ];
}

export function creaseVertexPoint(
  position: readonly number[],
  n0: readonly number[],
  n1: readonly number[],
): Vec3 {
  return [
    (6 * position[0]! + n0[0]! + n1[0]!) / 8,
    (6 * position[1]! + n0[1]! + n1[1]!) / 8,
    (6 * position[2]! + n0[2]! + n1[2]!) / 8,
  ];
}

function secondLargest(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => b - a);
  return sorted[1] ?? sorted[0]!;
}

function oppositeEnd(
  ends: readonly [VertexId, VertexId],
  vertexId: VertexId,
): VertexId {
  return ends[0] === vertexId ? ends[1] : ends[0];
}

export function computeVertexPoint(input: {
  mesh: HalfEdgeMesh;
  vertexId: VertexId;
  incidentEdges: readonly EdgeId[];
  incidentFaces: readonly FaceId[];
  edgeEnds: ReadonlyMap<EdgeId, readonly [VertexId, VertexId]>;
  facesByEdge: ReadonlyMap<EdgeId, readonly FaceId[]>;
  facePointPos: ReadonlyMap<FaceId, Vec3>;
  creaseWeightOf: (edgeId: EdgeId) => number;
}): Vec3 {
  const { mesh, vertexId, incidentEdges, incidentFaces, edgeEnds, facesByEdge, facePointPos, creaseWeightOf } =
    input;
  const S = mesh.vertices.get(vertexId)!.position;
  if (incidentEdges.length === 0) {
    return clonePoint(S);
  }

  const boundaryEdges = incidentEdges.filter((edgeId) => (facesByEdge.get(edgeId) ?? []).length < 2);
  if (boundaryEdges.length > 2) {
    throw new RangeError(
      `non-manifold-boundary-vertex: Vertex ${vertexId} has ${boundaryEdges.length} boundary branches`,
    );
  }
  if (boundaryEdges.length === 2) {
    const n0 = mesh.vertices.get(oppositeEnd(edgeEnds.get(boundaryEdges[0]!)!, vertexId))!.position;
    const n1 = mesh.vertices.get(oppositeEnd(edgeEnds.get(boundaryEdges[1]!)!, vertexId))!.position;
    return creaseVertexPoint(S, n0, n1);
  }
  if (boundaryEdges.length === 1) {
    const n0 = mesh.vertices.get(oppositeEnd(edgeEnds.get(boundaryEdges[0]!)!, vertexId))!.position;
    return [
      (S[0]! + n0[0]!) / 2,
      (S[1]! + n0[1]!) / 2,
      (S[2]! + n0[2]!) / 2,
    ];
  }

  const creaseEdges = incidentEdges.filter((edgeId) => isCreaseEdge(creaseWeightOf(edgeId), CREASE_EPSILON));
  const edgeMidpoints = incidentEdges.map((edgeId) => {
    const ends = edgeEnds.get(edgeId)!;
    const a = mesh.vertices.get(ends[0])!.position;
    const b = mesh.vertices.get(ends[1])!.position;
    return averageVec([a, b]);
  });
  const facePts = incidentFaces.map((id) => facePointPos.get(id)!);
  const smooth = smoothVertexPoint(S, facePts, edgeMidpoints);

  if (creaseEdges.length <= 1) {
    return smooth;
  }

  if (creaseEdges.length === 2) {
    const n0 = mesh.vertices.get(oppositeEnd(edgeEnds.get(creaseEdges[0]!)!, vertexId))!.position;
    const n1 = mesh.vertices.get(oppositeEnd(edgeEnds.get(creaseEdges[1]!)!, vertexId))!.position;
    const crease = creaseVertexPoint(S, n0, n1);
    const weight0 = creaseWeightOf(creaseEdges[0]!);
    const weight1 = creaseWeightOf(creaseEdges[1]!);
    const vertexCreaseWeight = Math.min(1, Math.max(0, (weight0 + weight1) / 2));
    return lerpPoint(smooth, crease, vertexCreaseWeight);
  }

  const weights = creaseEdges.map((edgeId) => creaseWeightOf(edgeId));
  return lerpPoint(smooth, S, secondLargest(weights));
}
