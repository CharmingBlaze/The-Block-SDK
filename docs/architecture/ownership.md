# Ownership boundaries

The modeling kit already has the canonical systems. Do **not** add a second scene graph, a second document, or a Three.js-owned object list.

| System | Package | Owns | Does not own |
| --- | --- | --- | --- |
| `ModelDocument` | `@modeling-kit/document` | Persistent project: hierarchy, names, local transforms, mesh/material/texture/skeleton/clip stores, settings, metadata, schema version, revision | Hover, camera, pointer, active tool, selection (unless saved), Three.js |
| Scene graph | `@modeling-kit/document` (`@modeling-kit/scene` re-exports) | Add/remove/reparent/duplicate/group, world matrices, effective visibility/lock | Render objects |
| `ModelingSession` | `@modeling-kit/commands` | Transient editor runtime, mesh kernels, history, transform gestures | GPU resources |
| `SelectionManager` | `@modeling-kit/selection` | Selected branded IDs | Raycasts |
| `InputEngine` | `@modeling-kit/input` | Packets → actions/gestures/axes | Commands, picking |
| `ToolManager` / `InteractionCoordinator` | `@modeling-kit/tools` | Active tool, exclusive pointer claims, `ModalToolSession` preview | Document mutation |
| `CommandManager` | `@modeling-kit/history` | Undo/redo stacks | Live kernels |
| `ThreeViewportAdapter` | `@modeling-kit/three-adapter` | Derived Object3D / BufferGeometry maps | Canonical IDs |

Route:

```
DOM bindDom → InputPacket → InputEngine → Action/Gesture
  → InteractionCoordinator → EditorTool → ModelingSession
  → Command → ModelDocument (+ optional document transaction)
  → DocumentChangeSet → ThreeViewportAdapter (incremental)
```

`document:changed.kind` tells the adapter what to do: `transform` updates matrices only; `visibility` and `name` skip geometry rebuild; `hierarchy` / omitted kind run a full graph sync.

## Conventions

Internal math is right-handed, **Y up**, **-Z forward**, radians, quaternion rotations. `DocumentSettings.angleUnit` is `"degrees"` for UI display only. `units` / `unitsPerMeter` describe saved numbers; default is meter with `unitsPerMeter: 1`.

Host-facing index: [`../README.md`](../README.md).
