import type { EdgeId, FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import {
  createMeshOperationContext,
  cutFace as cutFaceOp,
  splitEdge as splitEdgeOp,
  type CutEndpoint,
  type CutFaceResult as CutFaceOpResult,
  type HalfEdgeMesh,
  type SplitEdgeResult as SplitEdgeOpResult,
} from "@modeling-kit/mesh";

export type KnifeEndpoint = CutEndpoint;

export interface SplitEdgeResult {
  readonly vertexId: VertexId;
  readonly edgeIds: readonly [EdgeId, EdgeId];
}

export interface CutFaceResult {
  readonly fromVertexId: VertexId;
  readonly toVertexId: VertexId;
  readonly faceIds: readonly [FaceId, FaceId];
  readonly newEdgeId: EdgeId;
}

export function splitEdge(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
  t: number,
  ids: IdFactory,
): SplitEdgeResult {
  const result: SplitEdgeOpResult = splitEdgeOp(mesh, { edgeId, t }, createMeshOperationContext(ids));
  return { vertexId: result.newVertexId, edgeIds: [result.firstEdgeId, result.secondEdgeId] };
}

export function cutFace(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  from: KnifeEndpoint,
  to: KnifeEndpoint,
  ids: IdFactory,
): CutFaceResult {
  const result: CutFaceOpResult = cutFaceOp(
    mesh,
    { faceId, from, to },
    createMeshOperationContext(ids),
  );
  return {
    fromVertexId: result.fromVertexId,
    toVertexId: result.toVertexId,
    faceIds: [result.preservedFaceId, result.newFaceId],
    newEdgeId: result.newEdgeId,
  };
}
