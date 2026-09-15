import type { NodeId } from "@modeling-kit/core";
import { CyclicHierarchyError, NodeNotFoundError } from "@modeling-kit/core";
import { MAX_HIERARCHY_TRAVERSAL } from "./transform-cache";
import type { ModelDocument } from "./types";
import type { SceneNode } from "./scene-node";

export interface EffectiveState {
  readonly visible: boolean;
  readonly locked: boolean;
  readonly selectable: boolean;
}

interface EffectiveCacheEntry extends EffectiveState {
  flagRevision: number;
}

export class HierarchyIndex {
  private readonly effective = new Map<string, EffectiveCacheEntry>();
  private readonly flagRevisions = new Map<string, number>();
  invalidationCount = 0;

  bumpFlags(nodeId: NodeId): void {
    this.flagRevisions.set(nodeId, (this.flagRevisions.get(nodeId) ?? 0) + 1);
  }

  invalidate(nodeId: NodeId): void {
    if (this.effective.delete(nodeId)) {
      this.invalidationCount += 1;
    }
  }

  invalidateMany(nodeIds: readonly NodeId[]): void {
    for (const id of nodeIds) {
      this.invalidate(id);
    }
  }

  has(nodeId: NodeId): boolean {
    return this.effective.has(nodeId);
  }

  get(document: ModelDocument, nodeId: NodeId): EffectiveState {
    const chain: NodeId[] = [];
    let current: NodeId | null = nodeId;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) {
        throw new CyclicHierarchyError(nodeId, current);
      }
      if (chain.length >= MAX_HIERARCHY_TRAVERSAL) {
        throw new CyclicHierarchyError(nodeId, current);
      }
      seen.add(current);
      chain.push(current);
      current = requireNode(document, current).parentId;
    }
    let visible = true;
    let locked = false;
    for (let i = chain.length - 1; i >= 0; i--) {
      const id = chain[i]!;
      const flagRevision = this.flagRevisions.get(id) ?? 0;
      const cached = this.effective.get(id);
      if (cached && cached.flagRevision === flagRevision && i < chain.length - 1) {
        visible = cached.visible;
        locked = cached.locked;
        continue;
      }
      const node = requireNode(document, id);
      visible = visible && node.visible;
      locked = locked || node.locked;
      const selectable = node.selectable && visible && !locked;
      this.effective.set(id, { visible, locked, selectable, flagRevision });
    }
    const result = this.effective.get(nodeId);
    if (!result) {
      const node = requireNode(document, nodeId);
      return {
        visible: node.visible,
        locked: node.locked,
        selectable: node.selectable && node.visible && !node.locked,
      };
    }
    return result;
  }
}

const indexes = new WeakMap<ModelDocument, HierarchyIndex>();

export function hierarchyIndex(document: ModelDocument): HierarchyIndex {
  let index = indexes.get(document);
  if (!index) {
    index = new HierarchyIndex();
    indexes.set(document, index);
  }
  return index;
}

export function collectDescendants(document: ModelDocument, id: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const stack: NodeId[] = [...requireNode(document, id).childIds];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const childId = stack.pop()!;
    if (seen.has(childId)) {
      throw new CyclicHierarchyError(id, childId);
    }
    if (result.length >= MAX_HIERARCHY_TRAVERSAL) {
      throw new CyclicHierarchyError(id, childId);
    }
    seen.add(childId);
    result.push(childId);
    const child = requireNode(document, childId);
    for (let i = child.childIds.length - 1; i >= 0; i--) {
      stack.push(child.childIds[i]!);
    }
  }
  return result;
}

export function collectAncestors(document: ModelDocument, id: NodeId): NodeId[] {
  const result: NodeId[] = [];
  let current = requireNode(document, id).parentId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) {
      throw new CyclicHierarchyError(id, current);
    }
    if (result.length >= MAX_HIERARCHY_TRAVERSAL) {
      throw new CyclicHierarchyError(id, current);
    }
    seen.add(current);
    result.push(current);
    current = requireNode(document, current).parentId;
  }
  return result;
}

function requireNode(document: ModelDocument, id: NodeId): SceneNode {
  const node = document.scene.nodes.get(id);
  if (!node) {
    throw new NodeNotFoundError(id);
  }
  return node;
}
