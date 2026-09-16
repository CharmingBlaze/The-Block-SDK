import {
  CyclicHierarchyError,
  HierarchyError,
  NodeNotFoundError,
  type BoneId,
  type SkeletonId,
} from "@modeling-kit/core";
import {
  identityTransform,
  Matrix4,
  Quaternion,
  transformToMatrix,
  type TransformData,
} from "@modeling-kit/math";
import type { SkeletonData } from "@modeling-kit/document";
import type { Bone, Skeleton } from "../types";
import { collectChildren, collectRootBoneIds, orderBonesStable } from "./hierarchy";
import { assertValidSkeletonData } from "./validation";
import { skeletonToData } from "./serialization";

export interface AddBoneOptions {
  readonly id: BoneId;
  readonly name: string;
  readonly parentId?: BoneId | null;
  readonly restTransform?: TransformData;
}

export class SkeletonBuilder {
  private readonly records = new Map<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >();

  constructor(
    readonly id: SkeletonId,
    readonly name = "Skeleton",
  ) {}

  addBone(options: AddBoneOptions): this {
    const parentId = options.parentId ?? null;
    if (this.records.has(options.id)) {
      throw new HierarchyError("DUPLICATE_BONE", `Bone '${options.id}' is already defined`);
    }
    if (parentId && parentId === options.id) {
      throw new CyclicHierarchyError(options.id, parentId);
    }
    this.records.set(options.id, {
      name: options.name,
      parentId,
      restTransform: options.restTransform ?? identityTransform(),
    });
    return this;
  }

  build(): Skeleton {
    return buildSkeleton(this.id, this.name, this.records);
  }
}

export function skeletonFromData(data: SkeletonData): Skeleton {
  assertValidSkeletonData(data);
  const records = new Map<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >();
  for (const bone of data.bones) {
    records.set(bone.id, {
      name: bone.name,
      parentId: bone.parentId,
      restTransform: normalizeRestRotation(bone.restTransform),
    });
  }
  return buildSkeleton(data.id, data.name, records);
}

export { skeletonToData };

export function reparentBone(
  skeleton: Skeleton,
  boneId: BoneId,
  newParentId: BoneId | null,
): Skeleton {
  if (!skeleton.bones.has(boneId)) {
    throw new NodeNotFoundError(boneId);
  }
  if (newParentId === boneId) {
    throw new CyclicHierarchyError(boneId, newParentId);
  }
  if (newParentId && !skeleton.bones.has(newParentId)) {
    throw new NodeNotFoundError(newParentId);
  }
  if (newParentId) {
    let cursor: BoneId | null = newParentId;
    while (cursor) {
      if (cursor === boneId) {
        throw new CyclicHierarchyError(boneId, newParentId);
      }
      cursor = skeleton.bones.get(cursor)?.parentId ?? null;
    }
  }
  const records = new Map<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >();
  for (const bone of skeleton.bones.values()) {
    records.set(bone.id, {
      name: bone.name,
      parentId: bone.id === boneId ? newParentId : bone.parentId,
      restTransform: bone.restTransform,
    });
  }
  return buildSkeleton(skeleton.id, skeleton.name, records);
}

function normalizeRestRotation(transform: TransformData): TransformData {
  return {
    ...transform,
    rotation: Quaternion.from(transform.rotation).normalize().toJSON(),
  };
}

function buildSkeleton(
  id: SkeletonId,
  name: string,
  records: ReadonlyMap<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >,
): Skeleton {
  const children = collectChildren(records);
  const rootBoneIds = collectRootBoneIds(records);
  const order = orderBonesStable(records);
  const bones = new Map<BoneId, Bone>();
  const worldByBone = new Map<BoneId, Matrix4>();
  for (const boneId of order) {
    const record = records.get(boneId);
    if (!record) {
      continue;
    }
    const parentWorld = record.parentId ? worldByBone.get(record.parentId) : Matrix4.identity();
    const world = (parentWorld ?? Matrix4.identity()).multiply(transformToMatrix(record.restTransform));
    worldByBone.set(boneId, world);
    bones.set(boneId, {
      id: boneId,
      name: record.name,
      parentId: record.parentId && records.has(record.parentId) ? record.parentId : null,
      childIds: children.get(boneId) ?? [],
      restTransform: record.restTransform,
      inverseBindMatrix: world.invert(),
    });
  }
  return { id, name, bones, rootBoneIds };
}
