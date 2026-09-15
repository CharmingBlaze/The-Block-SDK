import type { FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { findEdge } from "../internal/rebuild";
import type { MeshOperationContext } from "./contract";
import { cutFace, type CutFaceResult } from "./cut-face";

export interface ConnectVerticesRequest {
  readonly a: VertexId;
  readonly b: VertexId;
  readonly faceId?: FaceId;
}

export function connectVertices(
  mesh: HalfEdgeMesh,
  request: ConnectVerticesRequest,
  ctx: MeshOperationContext,
): CutFaceResult {
  if (request.a === request.b) {
    throw new RangeError("connectVertices requires two distinct vertices");
  }
  if (findEdge(mesh, request.a, request.b)) {
    throw new RangeError("connectVertices cannot cut along an existing edge");
  }
  const faceId = request.faceId ?? findSharedFace(mesh, request.a, request.b);
  if (!faceId) {
    throw new RangeError("connectVertices requires two vertices on a common face");
  }
  return cutFace(
    mesh,
    {
      faceId,
      from: { kind: "vertex", vertexId: request.a },
      to: { kind: "vertex", vertexId: request.b },
    },
    ctx,
  );
}

function findSharedFace(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): FaceId | null {
  const facesA = new Set(mesh.getVertexFaces(a));
  for (const faceId of mesh.getVertexFaces(b)) {
    if (facesA.has(faceId)) {
      return faceId;
    }
  }
  return null;
}
