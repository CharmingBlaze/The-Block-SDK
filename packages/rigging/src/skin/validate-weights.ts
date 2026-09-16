import type { VertexId } from "@modeling-kit/core";
import { Matrix4 } from "@modeling-kit/math";
import type { BoneWeight, MeshSkinningData, Skeleton } from "../types";
import { DEFAULT_MAX_BONE_INFLUENCES, WEIGHT_SUM_EPSILON } from "../constants";

export interface WeightIssue {
  readonly code: string;
  readonly message: string;
  readonly vertexId?: VertexId;
}

export function validateWeights(
  skeleton: Skeleton,
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
): string[] {
  return validateWeightIssues(skeleton, weights, maxInfluences).map((issue) => issue.message);
}

export function validateWeightIssues(
  skeleton: Skeleton,
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
): WeightIssue[] {
  const issues: WeightIssue[] = [];
  for (const [vertexId, influences] of weights) {
    if (influences.length > maxInfluences) {
      issues.push({
        code: "TOO_MANY_INFLUENCES",
        message: `Vertex ${vertexId} has ${influences.length} influences (max ${maxInfluences})`,
        vertexId,
      });
    }
    const sum = influences.reduce((acc, item) => acc + item.weight, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_EPSILON) {
      issues.push({
        code: "WEIGHT_SUM",
        message: `Vertex ${vertexId} weights sum to ${sum}`,
        vertexId,
      });
    }
    for (const item of influences) {
      if (!Number.isFinite(item.weight) || item.weight < 0) {
        issues.push({
          code: "INVALID_WEIGHT",
          message: `Vertex ${vertexId} has a non-finite or negative weight`,
          vertexId,
        });
      }
      if (!skeleton.bones.has(item.boneId)) {
        issues.push({
          code: "MISSING_BONE",
          message: `Vertex ${vertexId} references missing bone ${item.boneId}`,
          vertexId,
        });
      }
    }
  }
  return issues;
}

export function validateInverseBindMatrices(
  skeleton: Skeleton,
  skin: MeshSkinningData,
): WeightIssue[] {
  const issues: WeightIssue[] = [];
  if (!skin.inverseBindMatrices) {
    return issues;
  }
  for (const [boneId, matrix] of skin.inverseBindMatrices) {
    if (!skeleton.bones.has(boneId)) {
      issues.push({
        code: "IBM_MISSING_BONE",
        message: `Inverse bind matrix references missing bone ${boneId}`,
      });
      continue;
    }
    if (!(matrix instanceof Matrix4) || matrix.elements.some((value) => !Number.isFinite(value))) {
      issues.push({
        code: "IBM_NON_FINITE",
        message: `Inverse bind matrix for bone ${boneId} is not finite`,
      });
    }
  }
  return issues;
}

export function validateSkinBinding(skeleton: Skeleton, skin: MeshSkinningData): WeightIssue[] {
  return [
    ...validateWeightIssues(skeleton, skin.weights, skin.maxInfluences),
    ...validateInverseBindMatrices(skeleton, skin),
  ];
}
