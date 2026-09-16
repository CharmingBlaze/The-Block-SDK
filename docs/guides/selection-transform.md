# Selection, transform, and snapping

Selection, transforms, and snaps are headless. The viewport only reports hits; it does not own the selection set.

## Selection

`@modeling-kit/selection` stores branded IDs in one of four domains: `object`, `face`, `edge`, `vertex`.

```ts
session.selection.replace({
  domain: "face",
  objectId: cube.objectId,
  elementIds: [cube.faceIds.top],
});
```

Topology helpers (pure functions on a mesh + current IDs):

| Helper | Role |
| --- | --- |
| `growElementIds` / `shrinkElementIds` | One ring out / in |
| `linkedElementIds` | Connected island |
| `edgeLoopIds` / `edgeRingIds` | Quad loop / ring |
| `boundaryElementIds` | Open boundary |
| `coplanarFaceIds` / `similarMaterialFaceIds` | Flood by plane / slot |
| `invertElementIds` / `allElementIds` | Invert / select all in domain |
| `boxSelectIds` / `lassoSelectIds` | Screen marquee (host supplies projected points) |

Destructive mesh ops return a `TopologyMapping`. Commands remap the live selection so undo/redo restores the same conceptual faces/edges/vertices.

Click apply modes: `replace` | `add` | `toggle` | `subtract` (`PointPickApplyMode` / `SelectionIntent`). Neutral pick contracts (`PointPickRequest`, `applyPointPickToSelection`, `VisibilityPickingAdapter`) live in this package and must not import Three.js.

## Transform

`@modeling-kit/transform` implements `TransformGesture` on `OperationLifecycleMachine`:

`idle → beginning → active → committing → completed` (or cancel / fail).

```ts
session.beginTransform({ mode: "translate", space: "world", pivot: "median" });
session.updateTransform({ translate: { x: 0, y: 0.1, z: 0 } }); // preview, no history
session.commitTransform(); // one SetTransformsCommand
session.cancelTransform(); // restore baseline, zero commands
```

| Concept | Values |
| --- | --- |
| Mode | translate / rotate / scale |
| Space | world / local / parent / view / normal |
| Pivot | median / bounds / active / cursor / individual origins |

Object and component (vertex) patches are exact before/after snapshots. Nested selection does not double-transform a child when its parent is also selected. After `commit()` or `restoreBaseline()`, further `update()` throws; call `dispose()` on an open drag.

Interactive topology tools (`KnifeTool`, `LoopCutTool`, `ExtrudeTool`, `BevelTool`, `MergeTool`) use the same machine via `ModalToolSession`. See [`../architecture/interactive-tools.md`](../architecture/interactive-tools.md).

## Snapping

`@modeling-kit/snapping` is a query service. Knife preview uses `querySnap` / `querySnapTuple`. The mesh kernel does not import snapping.

```ts
import { querySnap, defaultSnapPriorities } from "@modeling-kit/snapping";

const hit = querySnap({
  origin,
  direction,
  candidates,
  priorities: defaultSnapPriorities,
});
```

Targets: grid, vertex, edge, midpoint, face, face-surface. Priority plus hysteresis avoid flicker when two candidates are close. Exclude sets keep the dragged component from snapping to itself (SNAP-002).

Viewport gizmos are host-owned. Drive the session transform protocol; do not write `object.position` on derived Three.js nodes as the source of truth.
