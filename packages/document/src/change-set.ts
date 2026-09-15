import type {
  DocumentChangeKind,
  HierarchyChange,
  NodeChange,
  NodeChangeKind,
  ObjectId,
} from "@modeling-kit/core";

export type { NodeChange, NodeChangeKind, HierarchyChange };

export interface MeshChange {
  readonly meshId: string;
  readonly kind: "topology" | "positions" | "uvs" | "materials" | "metadata";
}

export interface MaterialChange {
  readonly materialId: string;
}

export interface TextureChange {
  readonly textureId: string;
}

export interface SkeletonChange {
  readonly skeletonId: string;
}

export interface AnimationChange {
  readonly animationId: string;
}

export interface StructuredDocumentChangeSet {
  revisionBefore: number;
  revisionAfter: number;
  addedNodes: ObjectId[];
  removedNodes: ObjectId[];
  changedNodes: NodeChange[];
  hierarchyChanges: HierarchyChange[];
  changedMeshes: MeshChange[];
  changedMaterials: MaterialChange[];
  changedTextures: TextureChange[];
  changedSkeletons: SkeletonChange[];
  changedAnimations: AnimationChange[];
  reason: string;
}

export function createChangeSet(reason: string, revisionBefore: number): StructuredDocumentChangeSet {
  return {
    revisionBefore,
    revisionAfter: revisionBefore,
    addedNodes: [],
    removedNodes: [],
    changedNodes: [],
    hierarchyChanges: [],
    changedMeshes: [],
    changedMaterials: [],
    changedTextures: [],
    changedSkeletons: [],
    changedAnimations: [],
    reason,
  };
}

export function inferredDocumentChangeKind(
  change: StructuredDocumentChangeSet,
): DocumentChangeKind {
  if (change.hierarchyChanges.length > 0 || change.addedNodes.length > 0 || change.removedNodes.length > 0) {
    return "hierarchy";
  }
  const kinds = new Set(change.changedNodes.map((item) => item.kind));
  if (kinds.size === 1) {
    const only = [...kinds][0]!;
    if (
      only === "transform" ||
      only === "visibility" ||
      only === "name" ||
      only === "locking" ||
      only === "mesh-reference" ||
      only === "material-slots" ||
      only === "skeleton-binding" ||
      only === "metadata"
    ) {
      return only;
    }
  }
  return "full";
}
