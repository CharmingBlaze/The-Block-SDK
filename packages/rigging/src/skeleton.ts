import { CyclicHierarchyError, HierarchyError, NodeNotFoundError, type BoneId, type SkeletonId } from "@modeling-kit/core";
import {
  identityTransform,
  Matrix4,
  transformToMatrix,
  type TransformData,
} from "@modeling-kit/math";
import type { BoneData, SkeletonData } from "@modeling-kit/document";
import type { Bone, Skeleton } from "./types";

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
  const records = new Map<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >();
  for (const bone of data.bones) {
    records.set(bone.id, {
      name: bone.name,
      parentId: bone.parentId,
      restTransform: bone.restTransform,
    });
  }
  return buildSkeleton(data.id, data.name, records);
}

export function skeletonToData(skeleton: Skeleton): SkeletonData {
  const bones: BoneData[] = [...skeleton.bones.values()].map((bone) => ({
    id: bone.id,
    name: bone.name,
    parentId: bone.parentId,
    restTransform: bone.restTransform,
    visible: true,
    locked: false,
    metadata: {},
  }));
  bones.sort((a, b) => a.id.localeCompare(b.id));
  return { id: skeleton.id, name: skeleton.name, bones, metadata: {} };
}

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

function buildSkeleton(
  id: SkeletonId,
  name: string,
  records: ReadonlyMap<
    BoneId,
    { name: string; parentId: BoneId | null; restTransform: TransformData }
  >,
): Skeleton {
  const children = new Map<BoneId, BoneId[]>();
  const rootBoneIds: BoneId[] = [];
  for (const [boneId, record] of records) {
    if (record.parentId) {
      if (!records.has(record.parentId)) {
        throw new NodeNotFoundError(record.parentId);
      }
      const list = children.get(record.parentId) ?? [];
      list.push(boneId);
      children.set(record.parentId, list);
    } else {
      rootBoneIds.push(boneId);
    }
  }

  const bones = new Map<BoneId, Bone>();
  const visiting = new Set<BoneId>();
  const writeBone = (boneId: BoneId, parentWorld: Matrix4): void => {
    if (visiting.has(boneId)) {
      throw new CyclicHierarchyError(boneId, boneId);
    }
    if (bones.has(boneId)) {
      return;
    }
    const record = records.get(boneId);
    if (!record) {
      return;
    }
    visiting.add(boneId);
    const local = transformToMatrix(record.restTransform);
    const world = parentWorld.multiply(local);
    bones.set(boneId, {
      id: boneId,
      name: record.name,
      parentId: record.parentId && records.has(record.parentId) ? record.parentId : null,
      childIds: children.get(boneId) ?? [],
      restTransform: record.restTransform,
      inverseBindMatrix: world.invert(),
    });
    for (const childId of children.get(boneId) ?? []) {
      writeBone(childId, world);
    }
    visiting.delete(boneId);
  };
  for (const rootId of rootBoneIds) {
    writeBone(rootId, Matrix4.identity());
  }
  if (bones.size !== records.size) {
    const missing = [...records.keys()].find((id) => !bones.has(id));
    throw new CyclicHierarchyError(missing ?? "unknown", missing ?? "unknown");
  }
  return { id, name, bones, rootBoneIds };
}
