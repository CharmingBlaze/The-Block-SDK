import type { PoseMap } from "@modeling-kit/rigging";
import { applyBoneRestTransform, type ThreeSkeletonResources } from "./create-skeleton";
import type { Skeleton as CanonicalSkeleton } from "@modeling-kit/rigging";

export function updateThreeSkeleton(
  resources: ThreeSkeletonResources,
  canonical: CanonicalSkeleton,
  localPose?: PoseMap,
): void {
  for (const boneData of canonical.bones.values()) {
    const bone = resources.boneById.get(boneData.id);
    if (!bone) {
      continue;
    }
    applyBoneRestTransform(bone, localPose?.get(boneData.id) ?? boneData.restTransform);
  }
  resources.skeleton.update();
}
