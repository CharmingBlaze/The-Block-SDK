import type { EdgeId, FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import {
  collectQuadEdgeLoop,
  createMeshOperationContext,
  loopCut as loopCutOp,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";

export { collectQuadEdgeLoop };
export {
  collectOrientedQuadEdgeLoop,
  previewLoopCut,
  loopCutFactors,
  factorOnOrientedEdge,
} from "@modeling-kit/mesh";

export interface LoopCutResult {
  readonly newVertexIds: VertexId[];
  readonly newFaceIds: FaceId[];
  readonly loopEdgeIds: EdgeId[];
}

export function loopCut(
  mesh: HalfEdgeMesh,
  startEdgeId: EdgeId,
  factor: number,
  ids: IdFactory,
  cuts = 1,
): LoopCutResult {
  const result = loopCutOp(
    mesh,
    { startEdgeId, factor, cuts },
    createMeshOperationContext(ids),
  );
  return {
    newVertexIds: result.newVertexIds,
    newFaceIds: result.newFaceIds,
    loopEdgeIds: result.loopEdgeIds,
  };
}
