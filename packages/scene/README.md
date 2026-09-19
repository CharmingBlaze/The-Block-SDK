# @modeling-kit/scene

**Scene graph and object hierarchy.** Manages the tree of objects (nodes) with transforms, visibility, and locking — analogous to a 3D scene outliner.

## Purpose

The `scene` package operates on the `EntityStore` from `@modeling-kit/document` to provide:

- **Hierarchy operations** — add, remove, reparent, group, ungroup nodes
- **Tree traversal** — ancestors, descendants, `isDescendant` checks
- **World transforms** — compute the world matrix for any node by walking parent chains
- **Visibility and locking** — `effectiveVisibility` and `effectiveLocked` respect parent inheritance
- **Duplicate subtrees** — deep-clone a node and all its children
- **Cycle prevention** — reparenting operations reject moves that would create cycles

## Key Exports

```ts
import {
  addNode, removeNode, reparent, groupNodes, ungroupNode,
  duplicateSubtree, clearSceneChildren,
  ancestors, descendants, traverse, isDescendant,
  getNode, renameNode, reorderChildren,
  setLocalTransform, worldMatrix,
  setNodeVisible, effectiveVisibility,
  setNodeLocked, effectiveLocked,
  restoreNode,
  type AddNodeInput, type ReparentMode,
} from "@modeling-kit/scene";
```

## Usage Example

```ts
import { addNode, reparent, worldMatrix, getNode } from "@modeling-kit/scene";
import type { EditorSession } from "@modeling-kit/document";

function createHierarchy(session: EditorSession) {
  const root = addNode(session.store, { name: "Root" });
  const child1 = addNode(session.store, { name: "Child1", parentId: root });
  const child2 = addNode(session.store, { name: "Child2", parentId: root });

  // Compute world position of child2
  const world = worldMatrix(session.store, child2);
  console.log("World:", world);

  // Reparent
  reparent(session.store, child2, { newParent: child1, mode: "keep-world" });
}
```

## Architecture Notes

- Nodes use `ObjectId` (branded string). The root entity is always present in a document.
- Transforms are stored as **local** (relative to parent) — world matrices are computed on demand.
- `effectiveVisibility` returns `false` if the node or any ancestor is hidden.
- `effectiveLocked` returns `true` if the node or any ancestor is locked.
- All operations mutate the `EntityStore` directly — callers are responsible for wrapping changes in commands for undo support.