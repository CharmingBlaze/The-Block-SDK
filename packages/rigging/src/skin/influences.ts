import type { BoneId } from "@modeling-kit/core";
import type { BoneWeight } from "../types";

export interface NormalizeWeightsOptions {
  readonly maxInfluences?: number;
  readonly fallbackBoneId?: BoneId;
  readonly dropNonPositive?: boolean;
}

export interface NormalizeWeightsResult {
  readonly influences: readonly BoneWeight[];
  readonly dropped: readonly BoneWeight[];
}

export function combineInfluences(influences: readonly BoneWeight[]): BoneWeight[] {
  const combined = new Map<BoneId, number>();
  for (const item of influences) {
    if (!Number.isFinite(item.weight)) {
      throw new RangeError("Bone weights must be finite");
    }
    if (item.weight < 0) {
      throw new RangeError("Bone weights must be finite and non-negative");
    }
    combined.set(item.boneId, (combined.get(item.boneId) ?? 0) + item.weight);
  }
  return [...combined.entries()].map(([boneId, weight]) => ({ boneId, weight }));
}

export function sortInfluencesDeterministic(influences: readonly BoneWeight[]): BoneWeight[] {
  return [...influences].sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.boneId.localeCompare(b.boneId);
  });
}
