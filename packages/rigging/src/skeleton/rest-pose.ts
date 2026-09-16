import type { BoneId } from "@modeling-kit/core";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type { PoseMap, Skeleton } from "../types";

export function restPose(skeleton: Skeleton): PoseMap {
  const pose = new Map<BoneId, TransformData>();
  for (const bone of skeleton.bones.values()) {
    pose.set(bone.id, bone.restTransform);
  }
  return pose;
}

export function identityLocalPose(): TransformData {
  return identityTransform();
}
