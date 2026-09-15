import type { BoneId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { BoneWeight, MeshSkinningData, Skeleton } from "./types";
import { evaluateWorldPose } from "./pose";

export function skinningFromEntries(
  skeletonId: Skeleton["id"],
  entries: readonly { vertexId: VertexId; influences: readonly BoneWeight[] }[],
  maxInfluences = 4,
): MeshSkinningData {
  const weights = new Map<VertexId, readonly BoneWeight[]>();
  for (const entry of entries) {
    weights.set(entry.vertexId, entry.influences);
  }
  return { skeletonId, maxInfluences, weights };
}

export function normalizeWeights(
  influences: readonly BoneWeight[],
  maxInfluences = 4,
): BoneWeight[] {
  if (!Number.isFinite(maxInfluences) || maxInfluences <= 0) {
    throw new RangeError("maxInfluences must be a positive finite number");
  }
  const combined = new Map<BoneId, number>();
  for (const item of influences) {
    if (!Number.isFinite(item.weight) || item.weight < 0) {
      throw new RangeError("Bone weights must be finite and non-negative");
    }
    combined.set(item.boneId, (combined.get(item.boneId) ?? 0) + item.weight);
  }
  const sorted = [...combined.entries()]
    .map(([boneId, weight]) => ({ boneId, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxInfluences);
  const sum = sorted.reduce((acc, item) => acc + item.weight, 0);
  if (sum <= 1e-8) {
    return sorted.length > 0 ? [{ boneId: sorted[0]!.boneId, weight: 1 }] : [];
  }
  return sorted.map((item) => ({ boneId: item.boneId, weight: item.weight / sum }));
}

export function assignRigidWeights(
  mesh: HalfEdgeMesh,
  boneId: BoneId,
): Map<VertexId, readonly BoneWeight[]> {
  const weights = new Map<VertexId, readonly BoneWeight[]>();
  for (const vertexId of mesh.vertices.keys()) {
    weights.set(vertexId, [{ boneId, weight: 1 }]);
  }
  return weights;
}

export function assignNearestBoneWeights(
  mesh: HalfEdgeMesh,
  skeleton: Skeleton,
  maxInfluences = 4,
): Map<VertexId, readonly BoneWeight[]> {
  const restWorld = evaluateWorldPose(skeleton);
  const origins: Array<{ boneId: BoneId; position: Vector3 }> = [];
  for (const [boneId, matrix] of restWorld) {
    origins.push({ boneId, position: matrix.transformPoint(new Vector3(0, 0, 0)) });
  }
  const weights = new Map<VertexId, readonly BoneWeight[]>();
  for (const [vertexId, vertex] of mesh.vertices) {
    const p = new Vector3(vertex.position[0], vertex.position[1], vertex.position[2]);
    const scored: BoneWeight[] = origins.map((origin) => {
      const d = p.distanceTo(origin.position);
      return { boneId: origin.boneId, weight: 1 / (d * d + 1e-4) };
    });
    weights.set(vertexId, normalizeWeights(scored, maxInfluences));
  }
  return weights;
}

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

export function validateWeights(
  skeleton: Skeleton,
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
): string[] {
  const issues: string[] = [];
  for (const [vertexId, influences] of weights) {
    const sum = influences.reduce((acc, item) => acc + item.weight, 0);
    if (Math.abs(sum - 1) > 1e-3) {
      issues.push(`Vertex ${vertexId} weights sum to ${sum}`);
    }
    for (const item of influences) {
      if (!skeleton.bones.has(item.boneId)) {
        issues.push(`Vertex ${vertexId} references missing bone ${item.boneId}`);
      }
    }
  }
  return issues;
}
