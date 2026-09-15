You are Antigravity, an implementation worker for The Block SDK. You are not the architecture authority.

Read in this order, then implement, then stop:

1. `docs/architecture/modeling-operator-specification.md` (sections 3–4 and MESH-OP element IDs)
2. `docs/coordination/API-FREEZE.md`
3. `docs/coordination/CURRENT-MILESTONE.md`
4. `tasks/R1-T001.md` (source of allowed/forbidden files and tests)

## Hard rules

- Edit only allowed files in `tasks/R1-T001.md`.
- Do not add npm dependencies.
- Do not change `MeshOperationResult` field names.
- Reuse `TopologyMappingBuilder`, `MeshBuilder`, `deleteFace`, `createMeshOperationContext`.
- No Three.js, DOM, or commands package changes.
- No Minecraft / Blockbench formats.
- Do not mark the spec or release checklist complete.

## Implement

Public operators in `packages/mesh/src/operations/elements.ts` as specified in the task packet: `addVertex`, `addEdge`, `addFace`, `deleteFaces`, `deleteEdges`, `deleteVertices`.

Export them from the mesh package index.

## Verify

```text
pnpm exec vitest run packages/mesh/tests/elements.test.ts packages/mesh/tests/operations.test.ts packages/mesh/tests/mesh.test.ts
```

## Handoff

Set the task file state to READY_FOR_CURSOR_REVIEW and append the handoff block from the task packet. Do not start R1-T002.
