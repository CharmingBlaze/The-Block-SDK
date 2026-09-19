# @modeling-kit/snapping

**Grid and element snapping system.** Snaps 3D positions to grids, edges, vertices, and face surfaces with configurable priorities and radii.

## Purpose

The `snapping` package provides:

- **Snap functions** — `snapToGrid`, `snapToEdge`, `snapToPoints`, `snapIncrement`, `snapAngle`, `snapVectorIncrement`
- **SnapQuery** — high-level query that tests a 3D position against all available snap targets and returns the best match
- **Priority system** — `defaultSnapPriorities` orders vertex > edge > grid > face snaps
- **Closest-point helpers** — `closestOnSegment`, `closestPointOnTriangle` for geometry projection

## Key Exports

```ts
import {
  snapToGrid, snapToEdge, snapToPoints,
  snapIncrement, snapAngle, snapVectorIncrement,
  closestOnSegment, closestPointOnTriangle, snapToClosestOnSegment,
  type SnapResult, type SnapTargetType,
} from "@modeling-kit/snapping";

import {
  SnapQuery, querySnap, querySnapTuple,
  computeMeshSnapRadius, defaultSnapPriorities,
  type SnapQueryOptions,
} from "@modeling-kit/snapping";
```

## Usage Example

```ts
import { snapToGrid, SnapQuery } from "@modeling-kit/snapping";

// Simple grid snap
const gridSnapped = snapToGrid([1.3, 0.7, -0.2], 0.5);
// [1.5, 0.5, 0.0]

// Full snap query against a mesh
const query = new SnapQuery({
  position: [1.2, 0.0, 0.8],
  mesh, // HalfEdgeMesh
  gridSize: 1.0,
  snapRadius: 0.3,
});
const result = query.resolve();
if (result) {
  console.log(result.position); // snapped position
  console.log(result.type);     // "vertex" | "edge" | "face" | "grid"
}
```

```ts
import { snapAngle, snapIncrement } from "@modeling-kit/snapping";

// Angle snapping (rotation)
const snapped = snapAngle(47, 15); // 45 (nearest 15° increment)

// Value snapping
const snappedVal = snapIncrement(1.23, 0.25); // 1.25
```

## Architecture Notes

- All snap functions are **pure** — they take a position and return a snapped position (or the original if no snap is within range).
- `SnapQuery` caches mesh snap targets (vertices, edge midpoints, face centers) and rebuilds when the mesh revision changes.
- `computeMeshSnapRadius` derives a sensible snap radius from the mesh's bounding box — typically 4% of the diagonal.
- Snap results include a `type` tag so the UI can display appropriate visual feedback (vertex marker, edge highlight, grid dot).
- This package is used by both `@modeling-kit/transform` (for move/rotate/scale snapping) and `@modeling-kit/tools` (for knife, loop-cut, etc.).