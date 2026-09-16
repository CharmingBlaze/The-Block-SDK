import type { BoneId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { BoneWeight, MeshSkinningData, Skeleton } from "../types";
import { DEFAULT_MAX_BONE_INFLUENCES } from "../constants";
import { evaluateWorldPose } from "../evaluation/world-pose";
import { normalizeWeights } from "./normalize-weights";

export function skinningFromEntries(
  skeletonId: Skeleton["id"],
  entries: readonly { vertexId: VertexId; influences: readonly BoneWeight[] }[],
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
): MeshSkinningData {
  const weights = new Map<VertexId, readonly BoneWeight[]>();
  for (const entry of entries) {
    weights.set(entry.vertexId, entry.influences);
  }
  return { skeletonId, maxInfluences, weights };
}

/** Preview: every vertex rigidly bound to one bone. */
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

/** Preview automatic weighting. Not a stable authoring feature. */
export function assignNearestBoneWeights(
  mesh: HalfEdgeMesh,
  skeleton: Skeleton,
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
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
