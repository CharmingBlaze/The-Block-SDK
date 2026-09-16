import type { BoneId } from "@modeling-kit/core";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type { PoseMap, Skeleton } from "../types";
import { restPose } from "../skeleton/rest-pose";

export function localPoseOrRest(skeleton: Skeleton, localPose?: PoseMap): PoseMap {
  if (!localPose) {
    return restPose(skeleton);
  }
  const merged = new Map<BoneId, TransformData>();
  for (const bone of skeleton.bones.values()) {
    merged.set(bone.id, localPose.get(bone.id) ?? bone.restTransform);
  }
  return merged;
}

export function emptyLocalPose(): TransformData {
  return identityTransform();
}
