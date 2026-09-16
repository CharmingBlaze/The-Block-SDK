import type { BoneId } from "@modeling-kit/core";
import { Matrix4, transformToMatrix } from "@modeling-kit/math";
import type { PoseMap, Skeleton, WorldPose } from "../types";

export function evaluateWorldPose(skeleton: Skeleton, localPose?: PoseMap): WorldPose {
  const world = new Map<BoneId, Matrix4>();
  const walk = (boneId: BoneId, parentWorld: Matrix4): void => {
    const bone = skeleton.bones.get(boneId);
    if (!bone) {
      return;
    }
    const local = localPose?.get(boneId) ?? bone.restTransform;
    const matrix = parentWorld.multiply(transformToMatrix(local));
    world.set(boneId, matrix);
    for (const childId of bone.childIds) {
      walk(childId, matrix);
    }
  };
  for (const rootId of skeleton.rootBoneIds) {
    walk(rootId, Matrix4.identity());
  }
  return world;
}
