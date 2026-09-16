import type { CornerId, EdgeId, FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { uvsDiscontinuous } from "./discontinuity";

export function detectSeamsFromCornerUvs(
  mesh: HalfEdgeMesh,
  faceIds: ReadonlySet<FaceId>,
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): Set<EdgeId> {
  const seams = new Set<EdgeId>();
  const seen = new Set<EdgeId>();
  for (const faceId of faceIds) {
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      if (seen.has(edgeId)) {
        continue;
      }
      seen.add(edgeId);
      if (isSeamEdge(mesh, edgeId, faceIds, cornerUvs)) {
        seams.add(edgeId);
      }
    }
  }
  return seams;
}

function isSeamEdge(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
  faceIds: ReadonlySet<FaceId>,
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): boolean {
  const [left, right] = mesh.getEdgeFaces(edgeId);
  if (!left || !right) {
    return true;
  }
  const leftSelected = faceIds.has(left);
  const rightSelected = faceIds.has(right);
  if (leftSelected !== rightSelected) {
    return true;
  }
  if (!leftSelected && !rightSelected) {
    return false;
  }
  const verts = mesh.getEdgeVertices(edgeId);
  if (!verts) {
    return false;
  }
  const cornersA = mesh.getFaceCorners(left);
  const cornersB = mesh.getFaceCorners(right);
  for (const vertexId of verts) {
    const ca = cornersA.find((id) => mesh.corners.get(id)?.vertexId === vertexId);
    const cb = cornersB.find((id) => mesh.corners.get(id)?.vertexId === vertexId);
    if (!ca || !cb) {
      continue;
    }
    const ua = cornerUvs.get(ca);
    const ub = cornerUvs.get(cb);
    if (!ua || !ub || uvsDiscontinuous(ua, ub)) {
      return true;
    }
  }
  return false;
}
