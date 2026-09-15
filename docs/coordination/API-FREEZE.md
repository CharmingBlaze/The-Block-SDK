# API freeze (Cursor-owned)

Antigravity must not change these without a Cursor-approved task that lists them under Allowed files.

## Frozen contracts

- `MeshOperationContext`, `MeshOperationResult`, `TopologyMapping`, `ElementMapping`, `SelectionSuggestion`, `MeshOperationWarning` in `@modeling-kit/mesh` `operations/contract.ts`
- Branded IDs in `@modeling-kit/core`
- `ModelDocument` / `CURRENT_SCHEMA_VERSION` (currently `2`) and native JSON shape
- `SelectionManager` snapshot / `replace` / `applyRemap` / `IdRemap` shapes (T002 may **add** methods; must not rename existing ones)
- Command `execute` / `undo` / `redo` on `@modeling-kit/history`
- Package names and dependency direction in `docs/architecture/sdk-architecture.md`

## Frozen policy

- No new npm dependencies
- No `three` / DOM in headless package mains
- No second scene graph, document, or mesh kernel
- No Minecraft / Blockbench formats
- Do not expand public exports except those named in the assigned task packet

## Allowed additive APIs (batch 3 / M3)

| Task | May add |
| ---- | ------- |
| R1-T005 | `querySnap` / SnapQuery types in `@modeling-kit/snapping`; knife calls it |
| R1-T006 | `TransformGesture.commit()`, `state` / `lifecycle` on gesture (CORE-003 `active` = XF-002 transforming) |
| R1-T007 | `@modeling-kit/sdk/three` optional export; remove adapter from sdk main |
| R1-T008 | `SceneNodeExtensionRegistry`; `registerSceneNodeExtension(document, typeId)` |

## Allowed additive APIs (batch 2 / M2)

| Task | May add |
| ---- | ------- |
| R1-T004 | `dissolveVertex`, `dissolveFace`, `collapseEdge`, `reverseFaceWinding` plus matching command classes |

## Allowed additive APIs (batch 1 only)

| Task | May add |
| ---- | ------- |
| R1-T001 | `addVertex`, `addEdge`, `addFace`, `deleteVertices`, `deleteEdges`, `deleteFaces` (names exact) returning types extending `MeshOperationResult`; request types; export from `packages/mesh/src/index.ts` |
| R1-T002 | `invert`, `selectAll`, `grow`, `shrink`, `selectLinked`, `selectEdgeLoop`, `selectEdgeRing`, `selectBoundary` on selection module; may take `HalfEdgeMesh` as argument; may add `@modeling-kit/mesh` workspace dependency to selection |
| R1-T003 | Private helpers in commands to apply `TopologyMapping` to `SelectionManager`; store selection snapshots on listed commands for undo |

## Explicitly not frozen (Cursor will change later)

- `@modeling-kit/sdk` depending on `three-adapter` (resolved R1-T007: optional `@modeling-kit/sdk/three`)
- README picking naming
- tools package mesh re-exports (do not add more)
