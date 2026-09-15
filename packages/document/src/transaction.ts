import type { DocumentChangeKind, NodeChangeKind, ObjectId } from "@modeling-kit/core";
import { cloneSceneNode, type SceneNode } from "./scene-node";
import { EntityStore } from "./entity-store";
import type { ModelDocument, SceneGraphData } from "./types";
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

interface TransactionState {
  readonly transaction: DocumentTransaction;
  readonly snapshot: SceneGraphData;
  readonly revisions: DocumentRevisions;
  readonly revision: number;
  readonly changeSet: StructuredDocumentChangeSet;
}

const activeTransactions = new WeakMap<ModelDocument, TransactionState>();

export function beginDocumentTransaction(
  document: ModelDocument,
  reason: string,
): DocumentTransaction {
  if (activeTransactions.has(document)) {
    throw new Error("Nested document transactions are not supported");
  }
  const snapshot = cloneSceneGraph(document.scene);
  const revisionBefore = document.revision;
  const revisionsBefore = { ...ensureDocumentRevisions(document) };
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
      document.scene.rootNodeId = snapshot.rootNodeId;
      document.scene.rootIds = [...snapshot.rootIds];
      document.scene.nodes = snapshot.nodes;
      document.revision = revisionBefore;
      document.revisions = { ...revisionsBefore };
      activeTransactions.delete(document);
    },
  };
  activeTransactions.set(document, {
    transaction,
    snapshot,
    revisions: revisionsBefore,
    revision: revisionBefore,
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

function cloneSceneGraph(scene: SceneGraphData): SceneGraphData {
  const nodes = new EntityStore<SceneNode>();
  for (const node of scene.nodes.values()) {
    nodes.set(cloneSceneNode(node));
  }
  nodes.revision = scene.nodes.revision;
  return {
    rootNodeId: scene.rootNodeId,
    rootIds: [...scene.rootIds],
    nodes,
  };
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
