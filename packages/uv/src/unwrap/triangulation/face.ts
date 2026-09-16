import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import { triangulatePolygon, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../errors";

export interface UnwrapFaceTriangle {
  readonly corners: readonly [CornerId, CornerId, CornerId];
  readonly vertexIds: readonly [VertexId, VertexId, VertexId];
}

export function triangulateFaceForUnwrap(mesh: HalfEdgeMesh, faceId: FaceId): UnwrapFaceTriangle[] {
  const verts = mesh.getFaceVertices(faceId);
  const corners = mesh.getFaceCorners(faceId);
  if (verts.length < 3 || corners.length < 3) {
    throw new UvUnwrapError("invalid-triangulation", `Face ${faceId} has fewer than 3 corners`, {
      faceIds: [faceId],
    });
  }
  if (verts.length !== corners.length) {
    throw new UvUnwrapError("missing-corner-mapping", `Face ${faceId} corner/vertex count mismatch`, {
      faceIds: [faceId],
    });
  }
  const points = verts.map((vertexId) => {
    const vertex = mesh.vertices.get(vertexId);
    if (!vertex) {
      throw new UvUnwrapError("missing-corner-mapping", `Missing vertex ${vertexId} on face ${faceId}`, {
        faceIds: [faceId],
      });
    }
    return [vertex.position[0], vertex.position[1], vertex.position[2]] as const;
  });
  if (points.some((point) => !point.every(Number.isFinite))) {
    throw new UvUnwrapError("non-finite-position", `Face ${faceId} has a non-finite vertex position`, {
      faceIds: [faceId],
    });
  }
  const triangulation = triangulatePolygon(points, { rejectSelfIntersecting: true });
  if (triangulation.status !== "ok" || triangulation.sourceVertexIndices.length === 0) {
    throw new UvUnwrapError(
      triangulation.status === "degenerate" ? "degenerate-triangle" : "invalid-triangulation",
      `Canonical triangulation failed for face ${faceId} (${triangulation.status})`,
      { faceIds: [faceId] },
    );
  }
  return triangulation.sourceVertexIndices.map((triple) => {
    const [ia, ib, ic] = triple;
    const cornerA = corners[ia];
    const cornerB = corners[ib];
    const cornerC = corners[ic];
    const vertexA = verts[ia];
    const vertexB = verts[ib];
    const vertexC = verts[ic];
    if (!cornerA || !cornerB || !cornerC || !vertexA || !vertexB || !vertexC) {
      throw new UvUnwrapError("missing-corner-mapping", `Triangulation of face ${faceId} referenced a missing corner`, {
        faceIds: [faceId],
      });
    }
    if (vertexA === vertexB || vertexB === vertexC || vertexA === vertexC) {
      throw new UvUnwrapError("degenerate-triangle", `Degenerate triangle produced for face ${faceId}`, {
        faceIds: [faceId],
        cornerIds: [cornerA, cornerB, cornerC],
      });
    }
    return {
      corners: [cornerA, cornerB, cornerC],
      vertexIds: [vertexA, vertexB, vertexC],
    };
  });
}
