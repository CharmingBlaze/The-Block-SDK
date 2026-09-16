import { CyclicHierarchyError, NodeNotFoundError, type BoneId } from "@modeling-kit/core";

export interface HierarchyRecord {
  readonly parentId: BoneId | null;
}

/**
 * Multiple roots are supported: a skeleton is a forest.
 * A bone with `parentId === null` is a root. Empty skeletons have zero roots.
 */
export function collectRootBoneIds<T extends HierarchyRecord>(
  records: ReadonlyMap<BoneId, T>,
): BoneId[] {
  const roots: BoneId[] = [];
  for (const [boneId, record] of records) {
    if (!record.parentId) {
      roots.push(boneId);
    }
  }
  roots.sort((a, b) => a.localeCompare(b));
  return roots;
}

export function collectChildren<T extends HierarchyRecord>(
  records: ReadonlyMap<BoneId, T>,
): Map<BoneId, BoneId[]> {
  const children = new Map<BoneId, BoneId[]>();
  for (const [boneId, record] of records) {
    if (!record.parentId) {
      continue;
    }
    if (!records.has(record.parentId)) {
      throw new NodeNotFoundError(record.parentId);
    }
    const list = children.get(record.parentId) ?? [];
    list.push(boneId);
    children.set(record.parentId, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return children;
}

export function assertNoParentCycles<T extends HierarchyRecord>(
  records: ReadonlyMap<BoneId, T>,
): void {
  const visiting = new Set<BoneId>();
  const visited = new Set<BoneId>();
  const visit = (boneId: BoneId): void => {
    if (visited.has(boneId)) {
      return;
    }
    if (visiting.has(boneId)) {
      throw new CyclicHierarchyError(boneId, boneId);
    }
    visiting.add(boneId);
    const parentId = records.get(boneId)?.parentId;
    if (parentId) {
      if (!records.has(parentId)) {
        throw new NodeNotFoundError(parentId);
      }
      visit(parentId);
    }
    visiting.delete(boneId);
    visited.add(boneId);
  };
  for (const boneId of records.keys()) {
    visit(boneId);
  }
}

/** Breadth-first, roots then children, siblings sorted by id. */
export function orderBonesStable<T extends HierarchyRecord>(records: ReadonlyMap<BoneId, T>): BoneId[] {
  assertNoParentCycles(records);
  const children = collectChildren(records);
  const roots = collectRootBoneIds(records);
  const ordered: BoneId[] = [];
  const queue = [...roots];
  const seen = new Set<BoneId>();
  while (queue.length > 0) {
    const boneId = queue.shift()!;
    if (seen.has(boneId)) {
      continue;
    }
    seen.add(boneId);
    ordered.push(boneId);
    for (const childId of children.get(boneId) ?? []) {
      queue.push(childId);
    }
  }
  if (ordered.length !== records.size) {
    const missing = [...records.keys()].find((id) => !seen.has(id));
    throw new CyclicHierarchyError(missing ?? "unknown", missing ?? "unknown");
  }
  return ordered;
}
