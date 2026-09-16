import type { BoneId, SkeletonId } from "@modeling-kit/core";
import type { InverseBindMatrix, MeshSkinBinding, SkeletonData } from "@modeling-kit/document";
import { Matrix4 } from "@modeling-kit/math";
import type { MeshSkinningData, Skeleton } from "../types";
import { orderBonesStable } from "./hierarchy";
import { restInverseBindMatrices } from "../evaluation/skin-matrices";
import { skinToBinding } from "../skin/skin-binding";

export function skeletonToData(skeleton: Skeleton): SkeletonData {
  const order = orderBonesStable(
    new Map([...skeleton.bones.values()].map((bone) => [bone.id, { parentId: bone.parentId }])),
  );
  const bones = order.map((boneId) => {
    const bone = skeleton.bones.get(boneId)!;
    return {
      id: bone.id,
      name: bone.name,
      parentId: bone.parentId,
      restTransform: bone.restTransform,
      visible: true,
      locked: false,
      metadata: {},
    };
  });
  return { id: skeleton.id, name: skeleton.name, bones, metadata: {} };
}

export function inverseBindEntriesFromSkeleton(skeleton: Skeleton): InverseBindMatrix[] {
  const entries: InverseBindMatrix[] = [];
  for (const [boneId, matrix] of restInverseBindMatrices(skeleton)) {
    entries.push({ boneId, matrix: [...matrix.elements] });
  }
  entries.sort((a, b) => a.boneId.localeCompare(b.boneId));
  return entries;
}

export function skinBindingWithRestIbm(skeleton: Skeleton, skin: MeshSkinningData): MeshSkinBinding {
  const binding = skinToBinding(skin);
  if (binding.inverseBindMatrices) {
    return binding;
  }
  return {
    ...binding,
    inverseBindMatrices: inverseBindEntriesFromSkeleton(skeleton),
  };
}

export function matricesFromSkeleton(skeleton: Skeleton): Map<BoneId, Matrix4> {
  return restInverseBindMatrices(skeleton);
}

export type { SkeletonId };
