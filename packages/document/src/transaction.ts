import type { DocumentChangeKind, NodeChangeKind, ObjectId } from "@modeling-kit/core";
import { cloneSceneNode, type SceneNode } from "./scene-node";
import { EntityStore } from "./entity-store";
import type { DocumentSettings, ModelDocument, SceneGraphData } from "./types";
import {
  createChangeSet,
  inferredDocumentChangeKind,
  type StructuredDocumentChangeSet,
} from "./change-set";
import { bumpDocumentRevisions, ensureDocumentRevisions } from "./revisions";
import type { DocumentRevisions } from "@modeling-kit/core";

export type ActiveMutation =
  | { type: "added"; nodeId: ObjectId; parentId: ObjectId | null }
  | { type: "removed"; nodeId: ObjectId; parentId: ObjectId | null }
  | { type: "reparent"; nodeId: ObjectId; parentId: ObjectId | null; previousParentId: ObjectId | null; previousIndex: number; nextIndex: number }
  | { type: "reorder"; nodeId: ObjectId; parentId: ObjectId | null }
  | { type: "changed"; nodeId: ObjectId; kind: NodeChangeKind };

export interface DocumentTransaction {
  readonly reason: string;
  readonly revisionBefore: number;
  commit(kind?: DocumentChangeKind, objectIds?: readonly ObjectId[]): DocumentTransactionResult;
  rollback(): void;
}

export interface DocumentTransactionResult {
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly reason: string;
  readonly kind: DocumentChangeKind;
  readonly objectIds: readonly ObjectId[];
  readonly changeSet: StructuredDocumentChangeSet;
}

interface DocumentSnapshot {
  readonly name: string;
  readonly settings: DocumentSettings;
  readonly metadata: Record<string, unknown>;
  readonly scene: SceneGraphData;
  readonly meshes: ModelDocument["meshes"];
  readonly materials: ModelDocument["materials"];
  readonly materialInstances: ModelDocument["materialInstances"];
  readonly textures: ModelDocument["textures"];
  readonly textureSets: ModelDocument["textureSets"];
  readonly images: ModelDocument["images"];
  readonly skeletons: ModelDocument["skeletons"];
  readonly animations: ModelDocument["animations"];
  readonly revisions: DocumentRevisions;
  readonly revision: number;
}

interface TransactionState {
  readonly transaction: DocumentTransaction;
  readonly snapshot: DocumentSnapshot;
  readonly changeSet: StructuredDocumentChangeSet;
}

const activeTransactions = new WeakMap<ModelDocument, TransactionState>();

/**
 * Begin an atomic document mutation. Rollback restores the scene graph,
 * resource stores (meshes, materials, instances, textures, texture sets,
 * images, skeletons, animations), identity (name/settings/metadata), and
 * revision counters. Kernel maps on `CommandContext` are not part of
 * `ModelDocument` and remain the command's responsibility.
 */
export function beginDocumentTransaction(
  document: ModelDocument,
  reason: string,
): DocumentTransaction {
  if (activeTransactions.has(document)) {
    throw new Error("Nested document transactions are not supported");
  }
  const snapshot = snapshotDocument(document);
  const revisionBefore = document.revision;
  const changeSet = createChangeSet(reason, revisionBefore);
  const transaction: DocumentTransaction = {
    reason,
    revisionBefore,
    commit(kind?: DocumentChangeKind, objectIds: readonly ObjectId[] = []) {
      const inferred = kind ?? inferredDocumentChangeKind(changeSet);
      bumpDocumentRevisions(document, revisionKeysForChange(inferred));
      changeSet.revisionAfter = document.revision;
      const ids =
        objectIds.length > 0
          ? objectIds
          : [
              ...changeSet.addedNodes,
              ...changeSet.removedNodes,
              ...changeSet.changedNodes.map((item) => item.nodeId),
              ...changeSet.hierarchyChanges.map((item) => item.nodeId),
            ];
      activeTransactions.delete(document);
      return {
        revisionBefore,
        revisionAfter: document.revision,
        reason,
        kind: inferred,
        objectIds: ids,
        changeSet,
      };
    },
    rollback() {
      restoreDocument(document, snapshot);
      activeTransactions.delete(document);
    },
  };
  activeTransactions.set(document, {
    transaction,
    snapshot,
    changeSet,
  });
  return transaction;
}

export function recordNodeChange(document: ModelDocument, mutation: ActiveMutation): void {
  const active = activeTransactions.get(document);
  if (!active) {
    return;
  }
  const { changeSet } = active;
  if (mutation.type === "added") {
    changeSet.addedNodes.push(mutation.nodeId);
    return;
  }
  if (mutation.type === "removed") {
    changeSet.removedNodes.push(mutation.nodeId);
    return;
  }
  if (mutation.type === "reparent") {
    changeSet.hierarchyChanges.push({
      nodeId: mutation.nodeId,
      previousParentId: mutation.previousParentId,
      nextParentId: mutation.parentId,
      previousIndex: mutation.previousIndex,
      nextIndex: mutation.nextIndex,
    });
    changeSet.changedNodes.push({ nodeId: mutation.nodeId, kind: "hierarchy" });
    return;
  }
  if (mutation.type === "reorder") {
    changeSet.hierarchyChanges.push({
      nodeId: mutation.nodeId,
      previousParentId: mutation.parentId,
      nextParentId: mutation.parentId,
      previousIndex: -1,
      nextIndex: -1,
    });
    return;
  }
  changeSet.changedNodes.push({ nodeId: mutation.nodeId, kind: mutation.kind });
}

function snapshotDocument(document: ModelDocument): DocumentSnapshot {
  return {
    name: document.name,
    settings: cloneValue(document.settings),
    metadata: cloneValue(document.metadata),
    scene: cloneSceneGraph(document.scene),
    meshes: cloneStore(document.meshes),
    materials: cloneStore(document.materials),
    materialInstances: cloneStore(document.materialInstances),
    textures: cloneStore(document.textures),
    textureSets: cloneStore(document.textureSets),
    images: cloneStore(document.images),
    skeletons: cloneStore(document.skeletons),
    animations: cloneStore(document.animations),
    revisions: { ...ensureDocumentRevisions(document) },
    revision: document.revision,
  };
}

function restoreDocument(document: ModelDocument, snapshot: DocumentSnapshot): void {
  document.name = snapshot.name;
  document.settings = snapshot.settings;
  document.metadata = snapshot.metadata;
  document.scene.rootNodeId = snapshot.scene.rootNodeId;
  document.scene.rootIds = [...snapshot.scene.rootIds];
  document.scene.nodes = snapshot.scene.nodes;
  document.meshes = snapshot.meshes;
  document.materials = snapshot.materials;
  document.materialInstances = snapshot.materialInstances;
  document.textures = snapshot.textures;
  document.textureSets = snapshot.textureSets;
  document.images = snapshot.images;
  document.skeletons = snapshot.skeletons;
  document.animations = snapshot.animations;
  document.revision = snapshot.revision;
  document.revisions = { ...snapshot.revisions };
}

function cloneSceneGraph(scene: SceneGraphData): SceneGraphData {
  const nodes = new EntityStore<SceneNode>();
  for (const node of scene.nodes.values()) {
    nodes.set(cloneValue(node, () => cloneSceneNode(node)));
  }
  nodes.revision = scene.nodes.revision;
  return {
    rootNodeId: scene.rootNodeId,
    rootIds: [...scene.rootIds],
    nodes,
  };
}

function cloneStore<T extends { readonly id: import("@modeling-kit/core").Brand<string, string> }>(
  store: EntityStore<T>,
): EntityStore<T> {
  return EntityStore.fromJSON({
    revision: store.revision,
    items: [...store.values()].map((item) => cloneValue(item)),
  });
}

function cloneValue<T>(value: T, fallback?: () => T): T {
  try {
    return structuredClone(value);
  } catch {
    if (fallback) {
      return fallback();
    }
    if (value !== null && typeof value === "object") {
      return { ...(value as Record<string, unknown>) } as T;
    }
    return value;
  }
}

function revisionKeysForChange(kind: DocumentChangeKind): (keyof DocumentRevisions)[] {
  switch (kind) {
    case "transform":
      return ["transforms"];
    case "hierarchy":
      return ["hierarchy"];
    case "topology":
      return ["topology"];
    case "positions":
      return ["positions"];
    case "uvs":
      return ["uv"];
    case "materials":
    case "material-slots":
      return ["materials"];
    default:
      return ["hierarchy"];
  }
}
