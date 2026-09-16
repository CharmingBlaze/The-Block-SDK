import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { ValidationMode } from "../contract";
import { CREASE_EPSILON } from "../creases/types";
import { readCreaseWeight } from "../creases/set";
import type { Vec3 } from "./types";
import { averageVec, lerpPoint } from "./vec";

export function effectiveCreaseWeight(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
  incidentFaceCount: number,
  mode: ValidationMode,
): number {
  if (incidentFaceCount < 2) {
    return 1;
  }
  return readCreaseWeight(mesh, edgeId, mode);
}

export function isCreaseEdge(weight: number, epsilon = CREASE_EPSILON): boolean {
  return weight > epsilon;
}

export function smoothEdgePoint(
  p0: readonly number[],
  p1: readonly number[],
  f0: readonly number[],
  f1: readonly number[],
): Vec3 {
  return averageVec([p0, p1, f0, f1]);
}

export function sharpEdgePoint(p0: readonly number[], p1: readonly number[]): Vec3 {
  return averageVec([p0, p1]);
}

export function weightedEdgePoint(
  mesh: HalfEdgeMesh,
  ends: readonly [VertexId, VertexId],
  incidentFaces: readonly FaceId[],
  facePointPos: ReadonlyMap<FaceId, Vec3>,
  creaseWeight: number,
): Vec3 {
  const p0 = mesh.vertices.get(ends[0])!.position;
  const p1 = mesh.vertices.get(ends[1])!.position;
  const sharp = sharpEdgePoint(p0, p1);
  if (incidentFaces.length !== 2) {
    return sharp;
  }
  const f0 = facePointPos.get(incidentFaces[0]!)!;
  const f1 = facePointPos.get(incidentFaces[1]!)!;
  const smooth = smoothEdgePoint(p0, p1, f0, f1);
  return lerpPoint(smooth, sharp, creaseWeight);
}
