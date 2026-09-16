import type { BoneId, VertexId } from "@modeling-kit/core";
import type { BoneWeight } from "../types";

export function copyWeights(
  source: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  mapping: ReadonlyMap<VertexId, VertexId>,
): Map<VertexId, readonly BoneWeight[]> {
  const next = new Map<VertexId, readonly BoneWeight[]>();
  for (const [from, to] of mapping) {
    const influences = source.get(from);
    if (influences) {
      next.set(to, influences);
    }
  }
  return next;
}

export function remapWeights(
  source: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  mapping: ReadonlyMap<VertexId, VertexId>,
): Map<VertexId, readonly BoneWeight[]> {
  return copyWeights(source, mapping);
}

export function mirrorWeightBones(
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  bonePairs: ReadonlyMap<BoneId, BoneId>,
): Map<VertexId, readonly BoneWeight[]> {
  const next = new Map<VertexId, readonly BoneWeight[]>();
  for (const [vertexId, influences] of weights) {
    next.set(
      vertexId,
      influences.map((item) => ({
        boneId: bonePairs.get(item.boneId) ?? item.boneId,
        weight: item.weight,
      })),
    );
  }
  return next;
}
