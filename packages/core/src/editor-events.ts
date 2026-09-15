import type { ObjectId } from "./brand";

export type DocumentChangeKind =
  | "transform"
  | "hierarchy"
  | "visibility"
  | "locking"
  | "topology"
  | "positions"
  | "uvs"
  | "materials"
  | "mesh-reference"
  | "material-slots"
  | "skeleton-binding"
  | "metadata"
  | "name"
  | "full";

export type NodeChangeKind =
  | "transform"
  | "hierarchy"
  | "visibility"
  | "locking"
  | "name"
  | "mesh-reference"
  | "material-slots"
  | "skeleton-binding"
  | "metadata";

export interface NodeChange {
  readonly nodeId: ObjectId;
  readonly kind: NodeChangeKind;
}

export interface HierarchyChange {
  readonly nodeId: ObjectId;
  readonly previousParentId: ObjectId | null;
  readonly nextParentId: ObjectId | null;
  readonly previousIndex: number;
  readonly nextIndex: number;
}

export type MeshChangeKind =
  | "topology"
  | "positions"
  | "uvs"
  | "seams"
  | "normals"
  | "materials"
  | "skin-weights"
  | "metadata";

export interface DocumentChangeSet {
  readonly aspect:
    "scene" | "mesh" | "material" | "texture" | "skeleton" | "animation" | "settings" | "metadata";
  readonly kind?: DocumentChangeKind;
  readonly meshChangeKind?: MeshChangeKind;
  readonly objectIds?: readonly ObjectId[];
  readonly entityIds?: readonly string[];
  readonly revisionBefore?: number;
  readonly revisionAfter?: number;
  readonly reason?: string;
  readonly addedNodes?: readonly ObjectId[];
  readonly removedNodes?: readonly ObjectId[];
  readonly changedNodes?: readonly NodeChange[];
  readonly hierarchyChanges?: readonly HierarchyChange[];
}

export interface SelectionChange {
  readonly domain: string;
  readonly ids: readonly string[];
}

export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly isDirty: boolean;
  readonly undoCount?: number;
  readonly redoCount?: number;
  readonly transactionDepth?: number;
}

export interface ToolChange {
  readonly toolId: string;
}

export interface MeshChangeSet {
  readonly meshIds: readonly string[];
  readonly kind?: MeshChangeKind;
}

export interface AnimationTimeChange {
  readonly time: number;
  readonly playing: boolean;
}

export type EditorEvents = {
  "document:changed": DocumentChangeSet;
  "selection:changed": SelectionChange;
  "history:changed": HistoryState;
  "tool:changed": ToolChange;
  "mesh:changed": MeshChangeSet;
  "animation:time-changed": AnimationTimeChange;
};
