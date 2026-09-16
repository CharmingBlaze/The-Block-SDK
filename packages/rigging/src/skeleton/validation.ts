import { HierarchyError, type BoneId } from "@modeling-kit/core";
import { Quaternion, type TransformData } from "@modeling-kit/math";
import type { SkeletonData } from "@modeling-kit/document";
import { assertNoParentCycles } from "./hierarchy";

export interface SkeletonIssue {
  readonly code: string;
  readonly message: string;
  readonly boneId?: BoneId;
}

export function validateRestTransform(transform: TransformData, boneId?: BoneId): SkeletonIssue[] {
  const issues: SkeletonIssue[] = [];
  const values = [
    transform.position.x,
    transform.position.y,
    transform.position.z,
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
    transform.scale.x,
    transform.scale.y,
    transform.scale.z,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    issues.push({
      code: "NON_FINITE_TRANSFORM",
      message: "Bone rest transform contains a non-finite number",
      ...(boneId ? { boneId } : {}),
    });
    return issues;
  }
  const quat = Quaternion.from(transform.rotation);
  if (quat.lengthSq() < 1e-12) {
    issues.push({
      code: "INVALID_QUATERNION",
      message: "Bone rest rotation has zero length",
      ...(boneId ? { boneId } : {}),
    });
  }
  if (transform.scale.x === 0 || transform.scale.y === 0 || transform.scale.z === 0) {
    issues.push({
      code: "INVALID_SCALE",
      message: "Bone rest scale contains a zero axis",
      ...(boneId ? { boneId } : {}),
    });
  }
  return issues;
}

export function validateSkeletonData(data: SkeletonData): SkeletonIssue[] {
  const issues: SkeletonIssue[] = [];
  if (!data.id) {
    issues.push({ code: "MISSING_SKELETON_ID", message: "Skeleton id is required" });
  }
  const seen = new Set<BoneId>();
  const records = new Map<BoneId, { parentId: BoneId | null }>();
  for (const bone of data.bones) {
    if (seen.has(bone.id)) {
      issues.push({ code: "DUPLICATE_BONE", message: `Bone '${bone.id}' is already defined`, boneId: bone.id });
    }
    seen.add(bone.id);
    records.set(bone.id, { parentId: bone.parentId });
    issues.push(...validateRestTransform(bone.restTransform, bone.id));
  }
  for (const bone of data.bones) {
    if (bone.parentId && bone.parentId === bone.id) {
      issues.push({ code: "SELF_PARENT", message: `Bone '${bone.id}' cannot parent itself`, boneId: bone.id });
    }
    if (bone.parentId && !records.has(bone.parentId)) {
      issues.push({
        code: "MISSING_PARENT",
        message: `Bone '${bone.id}' references missing parent '${bone.parentId}'`,
        boneId: bone.id,
      });
    }
  }
  try {
    assertNoParentCycles(records);
  } catch (error) {
    issues.push({
      code: "CYCLE",
      message: error instanceof Error ? error.message : "Skeleton hierarchy contains a cycle",
    });
  }
  return issues;
}

export function assertValidSkeletonData(data: SkeletonData): void {
  const issues = validateSkeletonData(data);
  const first = issues[0];
  if (first) {
    throw new HierarchyError(first.code, first.message);
  }
}
