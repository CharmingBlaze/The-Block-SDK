import type { EdgeId, FaceId, IdFactory } from "@modeling-kit/core";
import {
  createMeshOperationContext,
  dissolveEdges as dissolveEdgesOp,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";

export interface DissolveEdgesResult {
  readonly faceIds: FaceId[];
  readonly dissolved: EdgeId[];
}

export function dissolveEdges(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  ids: IdFactory,
): DissolveEdgesResult {
  return dissolveEdgesOp(mesh, edgeIds, createMeshOperationContext(ids));
}
