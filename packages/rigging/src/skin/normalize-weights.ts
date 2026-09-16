import type { BoneId } from "@modeling-kit/core";
import type { BoneWeight } from "../types";
import { DEFAULT_MAX_BONE_INFLUENCES, WEIGHT_ZERO_EPSILON } from "../constants";
import {
  combineInfluences,
  sortInfluencesDeterministic,
  type NormalizeWeightsOptions,
  type NormalizeWeightsResult,
} from "./influences";

export type { NormalizeWeightsOptions, NormalizeWeightsResult };

/**
 * Canonical weight normalizer used by import, commands, adapter, and export.
 *
 * 1. Drop non-positive influences (default).
 * 2. Combine duplicate bones.
 * 3. Sort by weight desc, then bone id.
 * 4. Keep the strongest `maxInfluences` (default 4).
 * 5. Normalize the remaining sum to 1.
 * 6. Report dropped influences.
 * 7. Empty results use `fallbackBoneId` or throw.
 */
export function normalizeWeightsWithReport(
  influences: readonly BoneWeight[],
  maxInfluencesOrOptions: number | NormalizeWeightsOptions = DEFAULT_MAX_BONE_INFLUENCES,
): NormalizeWeightsResult {
  const options =
    typeof maxInfluencesOrOptions === "number"
      ? { maxInfluences: maxInfluencesOrOptions }
      : maxInfluencesOrOptions;
  const maxInfluences = options.maxInfluences ?? DEFAULT_MAX_BONE_INFLUENCES;
  if (!Number.isFinite(maxInfluences) || maxInfluences <= 0) {
    throw new RangeError("maxInfluences must be a positive finite number");
  }
  const dropNonPositive = options.dropNonPositive !== false;
  const combined = combineInfluences(influences);
  const dropped: BoneWeight[] = [];
  const positive = dropNonPositive
    ? combined.filter((item) => {
        if (item.weight <= WEIGHT_ZERO_EPSILON) {
          dropped.push(item);
          return false;
        }
        return true;
      })
    : combined;
  const sorted = sortInfluencesDeterministic(positive);
  const kept = sorted.slice(0, maxInfluences);
  dropped.push(...sorted.slice(maxInfluences));
  const sum = kept.reduce((acc, item) => acc + item.weight, 0);
  if (sum <= WEIGHT_ZERO_EPSILON) {
    if (options.fallbackBoneId) {
      return { influences: [{ boneId: options.fallbackBoneId, weight: 1 }], dropped };
    }
    if (influences.length > 0) {
      throw new RangeError("No valid skin influences remain");
    }
    return { influences: [], dropped };
  }
  return {
    influences: kept.map((item) => ({ boneId: item.boneId, weight: item.weight / sum })),
    dropped,
  };
}

export function normalizeWeights(
  influences: readonly BoneWeight[],
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
  fallbackBoneId?: BoneId,
): BoneWeight[] {
  return [
    ...normalizeWeightsWithReport(influences, {
      maxInfluences,
      ...(fallbackBoneId ? { fallbackBoneId } : {}),
    }).influences,
  ];
}
