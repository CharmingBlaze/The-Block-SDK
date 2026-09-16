import type { BoneId } from "@modeling-kit/core";
import { Matrix4, nearlyEqual } from "@modeling-kit/math";
import type { MeshSkinningData, PoseMap, Skeleton } from "../types";
import { evaluateWorldPose } from "./world-pose";

export function resolveInverseBindMatrix(skeleton: Skeleton, skin: MeshSkinningData, boneId: BoneId): Matrix4 {
  if (skin.inverseBindMatrices) {
    return skin.inverseBindMatrices.get(boneId) ?? Matrix4.identity();
  }
  return skeleton.bones.get(boneId)?.inverseBindMatrix ?? Matrix4.identity();
}

export function restInverseBindMatrices(skeleton: Skeleton): Map<BoneId, Matrix4> {
  const matrices = new Map<BoneId, Matrix4>();
  for (const bone of skeleton.bones.values()) {
    matrices.set(bone.id, bone.inverseBindMatrix);
  }
  return matrices;
}

/** Skinning matrix `jointWorld * inverseBind` per bone. */
export function evaluateSkinMatrices(
  skeleton: Skeleton,
  skin: MeshSkinningData,
  localPose?: PoseMap,
): Map<BoneId, Matrix4> {
  const poseWorld = evaluateWorldPose(skeleton, localPose);
  const out = new Map<BoneId, Matrix4>();
  for (const bone of skeleton.bones.values()) {
    const world = poseWorld.get(bone.id);
    if (!world) {
      continue;
    }
    out.set(bone.id, world.multiply(resolveInverseBindMatrix(skeleton, skin, bone.id)));
  }
  return out;
}

export function inverseBindMatchesRest(
  skeleton: Skeleton,
  ibm: Matrix4,
  boneId: BoneId,
  epsilon = 1e-4,
): boolean {
  const rest = skeleton.bones.get(boneId)?.inverseBindMatrix;
  if (!rest) {
    return false;
  }
  return rest.elements.every((value, index) => nearlyEqual(value, ibm.elements[index] ?? Number.NaN, epsilon));
}
