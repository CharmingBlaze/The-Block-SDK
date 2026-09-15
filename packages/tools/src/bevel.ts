import type { EdgeId, FaceId, IdFactory } from "@modeling-kit/core";
import {
  createMeshOperationContext,
  bevelEdges as bevelEdgesOp,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";

export interface BevelEdgesResult {
  readonly chamferFaceIds: FaceId[];
  readonly remainingFaceIds: FaceId[];
}

export function bevelEdges(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  offset: number,
  ids: IdFactory,
): BevelEdgesResult {
  const result = bevelEdgesOp(mesh, { edgeIds, offset }, createMeshOperationContext(ids));
  return {
    chamferFaceIds: result.chamferFaceIds,
    remainingFaceIds: result.remainingFaceIds,
  };
}
