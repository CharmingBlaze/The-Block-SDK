import type { VertexId } from "@modeling-kit/core";

export interface VertexJointInfluence {
  readonly jointIndex: number;
  readonly weight: number;
}

export interface PrimitiveSkinWeights {
  readonly weights: Map<VertexId, VertexJointInfluence[]>;
}
