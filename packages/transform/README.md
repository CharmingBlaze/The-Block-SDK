# @modeling-kit/transform

**Object and vertex transform gestures.** Handles position, rotation, and scale manipulation with pivot computation, space conversion, and snap integration.

## Purpose

The `transform` package provides:

- **TransformGesture** — high-level gesture handler that translates pointer drags into transform deltas (move, rotate, scale) with axis constraints
- **Pivot computation** — `computePivot` determines the transform center from selection bounds
- **Space conversion** — `applyWorldToLocal` converts world-space moves to local transforms respecting parent chains
- **Batch application** — `writeObjectWorld` applies world transforms to objects; vertex patches apply directly to mesh positions
- **Snapshot/delta pattern** — `TransformSnapshot` captures starting state; `TransformDelta` records changes during a drag

## Key Exports

```ts
import {
  TransformGesture,
  type TransformGestureContext,
  type TransformMode,
  type TransformSpace,
  type TransformPivot,
  type TransformRequest,
  type TransformSnapshot,
  type TransformDelta,
  type TransformSnapOptions,
  type ObjectTransformPatch,
  type VertexPositionPatch,
} from "@modeling-kit/transform";

// Pivot and transform utilities
import {
  computePivot, type ComputePivotOptions,
  selectionRoots,
  deltaMatrix,
  worldPositionOf,
  writeObjectWorld,
  applyWorldToLocal,
  cloneTransform,
  transformsNearlyEqual,
} from "@modeling-kit/transform";
```

## Usage Example

```ts
import { TransformGesture, computePivot } from "@modeling-kit/transform";
import type { ModelingSession } from "@modeling-kit/commands";

const pivot = computePivot(session.store, session.selection.current);
const gesture = new TransformGesture({
  mode: "translate",
  space: "world",
  pivot,
  snapOptions: { gridSize: 1 },
});

// During pointer drag:
const delta = gesture.update(pointerStart, pointerCurrent, camera, viewport);
// delta contains the world-space translation to apply

// On drag end:
const patch = gesture.commit();
// Apply patch to objects...
```

## Architecture Notes

- `TransformGesture` is **stateless between drags** — each drag creates a new gesture instance.
- All transforms are applied through **command-wrapped patches** for undo/redo support.
- `TransformSpace` can be `"world"`, `"local"`, or `"view"` — the gesture handles conversion internally.
- `TransformMode` can be `"translate"`, `"rotate"`, or `"scale"` — each computes appropriate deltas from 2D pointer movement.
- Pivot computation respects selection domain: face/edge/vertex selection uses the geometric center; object selection uses the transform origin.
- Snap integration (`TransformSnapOptions`) delegates to `@modeling-kit/snapping` for grid and element snapping.