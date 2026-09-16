import type { BoneId } from "@modeling-kit/core";
import type { TransformData } from "@modeling-kit/math";
import type { Skeleton as CanonicalSkeleton } from "@modeling-kit/rigging";
import { Bone, Matrix4, Skeleton } from "three";

export interface ThreeSkeletonResources {
  readonly skeleton: Skeleton;
  readonly bones: readonly Bone[];
  readonly boneById: ReadonlyMap<BoneId, Bone>;
  readonly indexById: ReadonlyMap<BoneId, number>;
  readonly rootBones: readonly Bone[];
}

export function applyBoneRestTransform(bone: Bone, transform: TransformData): void {
  bone.position.set(transform.position.x, transform.position.y, transform.position.z);
  bone.quaternion
    .set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w)
    .normalize();
  bone.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}

export function toThreeMatrix(elements: readonly number[]): Matrix4 {
  return new Matrix4().fromArray([...elements]);
}

/**
 * Builds a Three.js skeleton from canonical bone IDs, parents, rest poses, and inverse binds.
 * The adapter never becomes the source of truth.
 */
export function createThreeSkeleton(canonical: CanonicalSkeleton): ThreeSkeletonResources {
  const boneById = new Map<BoneId, Bone>();
  const indexById = new Map<BoneId, number>();
  const bones: Bone[] = [];
  const inverses: Matrix4[] = [];
  const ordered = [...canonical.bones.values()];
  for (const [index, boneData] of ordered.entries()) {
    const bone = new Bone();
    bone.name = boneData.id;
    bone.userData.canonicalBoneId = boneData.id;
    applyBoneRestTransform(bone, boneData.restTransform);
    boneById.set(boneData.id, bone);
    indexById.set(boneData.id, index);
    bones.push(bone);
    inverses.push(toThreeMatrix(boneData.inverseBindMatrix.elements));
  }
  for (const boneData of ordered) {
    const bone = boneById.get(boneData.id);
    if (!bone) {
      continue;
    }
    if (boneData.parentId) {
      boneById.get(boneData.parentId)?.add(bone);
    }
  }
  const skeleton = new Skeleton(bones, inverses);
  const rootBones = canonical.rootBoneIds
    .map((id) => boneById.get(id))
    .filter((bone): bone is Bone => Boolean(bone));
  return { skeleton, bones, boneById, indexById, rootBones };
}
