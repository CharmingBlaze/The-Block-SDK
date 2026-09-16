import type { NodeId } from "@modeling-kit/core";
import { CyclicHierarchyError, NodeNotFoundError } from "@modeling-kit/core";
import { identityTransform, Matrix4, matrixToTransform, type TransformData } from "@modeling-kit/math";
import type { ModelDocument } from "./types";
import { composeTransform, parentWorldTimesLocal } from "./transforms";
import type { SceneNode } from "./scene-node";

export const MAX_HIERARCHY_TRAVERSAL = 250_000;

export interface WorldTransformCacheEntry {
  readonly nodeId: NodeId;
  localRevision: number;
  parentWorldRevision: number;
  worldRevision: number;
  matrix: Matrix4;
}

export class WorldTransformCache {
  private readonly entries = new Map<string, WorldTransformCacheEntry>();
  private readonly localRevisions = new Map<string, number>();
  private worldClock = 1;
  invalidationCount = 0;

  bumpLocal(nodeId: NodeId): number {
    const next = (this.localRevisions.get(nodeId) ?? 0) + 1;
    this.localRevisions.set(nodeId, next);
    return next;
  }

  localRevision(nodeId: NodeId): number {
    return this.localRevisions.get(nodeId) ?? 0;
  }

  has(nodeId: NodeId): boolean {
    return this.entries.has(nodeId);
  }

  invalidate(nodeId: NodeId): void {
    if (this.entries.delete(nodeId)) {
      this.invalidationCount += 1;
    }
  }

  invalidateSubtree(nodeIds: readonly NodeId[]): void {
    for (const id of nodeIds) {
      this.invalidate(id);
    }
  }

  clear(): void {
    this.entries.clear();
    this.localRevisions.clear();
    this.worldClock = 1;
  }

  getWorldMatrix(document: ModelDocument, nodeId: NodeId): Matrix4 {
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
    let parentMatrix = composeTransform(identityTransform());
    let parentWorldRevision = 0;
    for (let i = chain.length - 1; i >= 0; i--) {
      const id = chain[i]!;
      const localRev = this.localRevision(id);
      const cached = this.entries.get(id);
      if (
        cached &&
        cached.localRevision === localRev &&
        cached.parentWorldRevision === parentWorldRevision
      ) {
        parentMatrix = cached.matrix;
        parentWorldRevision = cached.worldRevision;
        continue;
      }
      const node = requireNode(document, id);
      const matrix = parentWorldTimesLocal(parentMatrix, node.localTransform);
      this.worldClock += 1;
      const entry: WorldTransformCacheEntry = {
        nodeId: id,
        localRevision: localRev,
        parentWorldRevision,
        worldRevision: this.worldClock,
        matrix,
      };
      this.entries.set(id, entry);
      parentMatrix = matrix;
      parentWorldRevision = entry.worldRevision;
    }
    return parentMatrix;
  }
}

const caches = new WeakMap<ModelDocument, WorldTransformCache>();

export function worldTransformCache(document: ModelDocument): WorldTransformCache {
  let cache = caches.get(document);
  if (!cache) {
    cache = new WorldTransformCache();
    caches.set(document, cache);
  }
  return cache;
}

export function getWorldMatrix(document: ModelDocument, id: NodeId): Matrix4 {
  return worldTransformCache(document).getWorldMatrix(document, id);
}

export function getWorldTransform(document: ModelDocument, id: NodeId): TransformData {
  return matrixToTransform(getWorldMatrix(document, id));
}

function requireNode(document: ModelDocument, id: NodeId): SceneNode {
  const node = document.scene.nodes.get(id);
  if (!node) {
    throw new NodeNotFoundError(id);
  }
  return node;
}
