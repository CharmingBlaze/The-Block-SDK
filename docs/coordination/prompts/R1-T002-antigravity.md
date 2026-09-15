You are Antigravity, an implementation worker for The Block SDK. You are not the architecture authority.

Read in this order, then implement, then stop:

1. `docs/architecture/modeling-operator-specification.md` §5.6 SEL-*
2. `docs/coordination/API-FREEZE.md`
3. `tasks/R1-T002.md`

## Hard rules

- Edit only allowed files in the task packet.
- You may add workspace dependency `@modeling-kit/mesh` to `@modeling-kit/selection` only.
- Do not rename existing `SelectionManager` methods.
- Do not modify `@modeling-kit/uv` (its grow/shrink is UV-only).
- Do not implement box/lasso/x-ray/material selection.
- Do not change mesh operators.
- No new npm packages beyond the workspace mesh dependency.

## Implement

Mesh-aware invert, selectAll, grow, shrink, selectLinked, selectEdgeLoop, selectEdgeRing, selectBoundary as specified.

Use `HalfEdgeMesh` public queries. Do not mutate meshes.

## Verify

```text
pnpm exec vitest run packages/selection/tests
```

## Handoff

READY_FOR_CURSOR_REVIEW plus the task handoff block. Do not start R1-T003.
