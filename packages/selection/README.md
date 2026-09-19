# @modeling-kit/selection

**Multi-domain selection management.** Tracks selected objects, faces, edges, and vertices with topology-aware selection growing, shrinking, and filtering.

## Purpose

The `selection` package provides:

- **SelectionManager** — the authoritative selection state for a session, supporting object, face, edge, and vertex domains
- **Topology queries** — grow, shrink, invert, edge loops, edge rings, boundary selection, coplanar face selection, material-based selection
- **Screen-space selection** — box/lasso/marquee select with containment and occlusion testing
- **Ray occlusion** — `RayOccluder` for determining which mesh elements are visible to a pick ray
- **Selection picking** — `defaultHoverPickPolicy`, `defaultBackfaceMode`, and related utilities for resolving pick hits to selection changes

## Key Exports

```ts
import {
  SelectionManager,
  type SelectionDomain,
  type SelectionSnapshot,
  type ReplaceSelectionInput,
  type SelectionChangeListener,
  type IdRemap,
} from "@modeling-kit/selection";

// Topology-based selection operations
import {
  allElementIds, boundaryElementIds,
  edgeLoopIds, edgeRingIds,
  growElementIds, shrinkElementIds,
  invertElementIds, linkedElementIds,
  boxSelectIds, lassoSelectIds,
  coplanarFaceIds, similarMaterialFaceIds,
  marqueeContainmentFromDrag, lassoContainmentFromWinding,
} from "@modeling-kit/selection";

// Occlusion
import { createRayOccluder, type OcclusionSample, type RayOccluder } from "@modeling-kit/selection";

// Picking policies
import {
  defaultBackfaceMode,
  defaultHoverPickPolicy,
  defaultViewportRect,
} from "@modeling-kit/selection";
```

## Usage Example

```ts
import { SelectionManager } from "@modeling-kit/selection";

const selection = new SelectionManager();

// Select faces
selection.replace({ domain: "face", ids: ["f-0", "f-1", "f-2"] });

// Add to selection
selection.add(["f-3"]);

// Remove from selection
selection.remove(["f-0"]);

// Clear
selection.clear();

// Get current selection
const snapshot = selection.current;
console.log(snapshot.domain); // "face"
console.log(snapshot.ids);    // ["f-1", "f-2", "f-3"]

// Listen for changes
selection.onChange((previous, current) => {
  console.log("Selection changed:", current.ids.length);
});
```

```ts
import { growElementIds, edgeLoopIds } from "@modeling-kit/selection";

// Grow selection to include adjacent faces
const grown = growElementIds(mesh, selection.current.ids);

// Select edge loops
const loop = edgeLoopIds(mesh, ["e-0"]);
```

## Architecture Notes

- `SelectionManager` is **domain-exclusive** — you select objects OR faces OR edges OR vertices, not a mix. Changing domain clears the previous selection.
- Selection state is part of `EditorSession` (from `@modeling-kit/document`), ensuring undo/redo support.
- Topology operations (`growElementIds`, `edgeLoopIds`, etc.) are **pure functions** — they take a mesh and IDs, return new ID sets, and do not mutate selection state.
- `RayOccluder` is used by the three-adapter's hybrid picking system to determine whether a face is occluded at the CPU level before falling back to GPU picking.