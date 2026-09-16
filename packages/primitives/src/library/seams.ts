import type { FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UV_SEAM_DELTA } from "./convert-types";

export function markUvSeams(mesh: HalfEdgeMesh): void {
  for (const [edgeId, edge] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      continue;
    }
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    for (const vertexId of ends) {
      const uvA = cornerUvAtVertex(mesh, f1, vertexId);
      const uvB = cornerUvAtVertex(mesh, f2, vertexId);
      if (!uvA || !uvB) {
        continue;
      }
      if (Math.hypot(uvA[0] - uvB[0], uvA[1] - uvB[1]) > UV_SEAM_DELTA) {
        edge.isSeam = true;
      }
    }
  }
}

function cornerUvAtVertex(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  vertexId: VertexId,
): [number, number] | undefined {
  const corners = mesh.getFaceCorners(faceId);
  const verts = mesh.getFaceVertices(faceId);
  for (let i = 0; i < verts.length; i++) {
    if (verts[i] === vertexId) {
      return mesh.corners.get(corners[i]!)?.uv;
    }
  }
  return undefined;
}
