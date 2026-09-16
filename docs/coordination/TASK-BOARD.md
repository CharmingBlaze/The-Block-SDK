# Task board

States: `DRAFT` | `READY_FOR_ANTIGRAVITY` | `IN_PROGRESS` | `READY_FOR_CURSOR_REVIEW` | `CHANGES_REQUESTED` | `VERIFIED` | `INTEGRATED` | `BLOCKED`

Chat summaries are not authoritative. Update this board when a task file changes state.

Tooling setup (Serena, Repomix, dependency-cruiser, Knip, fast-check) is Cursor-owned. See `docs/verification/TOOLING-AUDIT.md`. Do not treat tooling as an Antigravity task.

## Batch 1 (M1)

| Task ID | Title | State | Allowed packages | Forbidden | Packet |
| ------- | ----- | ----- | ---------------- | --------- | ------ |
| R1-T001 | Public mesh element operators | INTEGRATED | `@modeling-kit/mesh` | commands, selection, tools, sdk, docs except task handoff | `tasks/R1-T001.md` |
| R1-T002 | 3D selection topology ops | INTEGRATED | `@modeling-kit/selection` | mesh operations, commands, tools | `tasks/R1-T002.md` |
| R1-T003 | Command mapping + undo selection | INTEGRATED | `@modeling-kit/commands` (listed files) | mesh operator algorithms, selection grow/shrink, new deps | `tasks/R1-T003.md` |

## Batch 2 (M2)

| Task ID | Title | State | Packet |
| ------- | ----- | ----- | ------ |
| R1-T004 | dissolveVertex/dissolveFace/collapseEdge/reverseWinding | INTEGRATED | `tasks/R1-T004.md` |

## Batch 3 (M3)

| Task ID | Title | State | Packet |
| ------- | ----- | ----- | ------ |
| R1-T005 | SnapQuery service; knife uses it | INTEGRATED | `tasks/R1-T005.md` |
| R1-T006 | Transform OperationLifecycleMachine | INTEGRATED | `tasks/R1-T006.md` |

## Batch 4 (M4)

| Task ID | Title | State | Packet |
| ------- | ----- | ----- | ------ |
| R1-T007 | Split `@modeling-kit/sdk` headless vs three | INTEGRATED | `tasks/R1-T007.md` |
| R1-T008 | Replace `extensionNodeRegistry` global | INTEGRATED | `tasks/R1-T008.md` |

## Library integrations

| Task ID | Title | State | Allowed packages | Packet |
| ------- | ----- | ----- | ---------------- | ------ |
| R1-T013 | Robust geometric predicates | VERIFIED | `@modeling-kit/math` (+ mesh/selection call sites) | `tasks/R1-T013.md` |

## Backlog

None in M3–M7. Next Cursor-owned work is M8–M12 (box/lasso, formats, UV/paint evidence, CI, perf/lifecycle). Do not start without a new packet.

## Completed

- R1-T001, R1-T002, R1-T003 — 2026-09-15. `pnpm test` 258 passed; `pnpm typecheck` passed.
- R1-T004 — 2026-09-15. `pnpm test` 268 passed; `pnpm typecheck` passed. Removed illegal `packages/mesh/src/_depcruise-probe.ts` (`three` import).
- R1-T005 — 2026-09-15. Cursor review **accepted**. `querySnap` / `SnapQuery`; knife `previewPoint` uses `querySnap`. SNAP-002 exclude/hysteresis covered. Mesh does not import snapping. `pnpm test` 317; typecheck + build recorded.
- R1-T006 — 2026-09-15. Transform lifecycle tests + commands tests 32 passed; `pnpm typecheck` passed.
- R1-T007 — 2026-09-15. Headless `@modeling-kit/sdk`; viewport via three-adapter / `sdk/three`.
- R1-T008 — 2026-09-15. Per-document `SceneNodeExtensionRegistry`.
- R1-T009 — 2026-09-15. `session.capabilities.canExecute`.
- R1-T011 — 2026-09-15. Concave L-face inset (distance 0.05; large inset still inverts).
- R1-T012 — 2026-09-15. Two connected cube edges bevel.
- R1-T013 — 2026-09-16. `robust-predicates` behind `GeometryPredicates`. Focused tests 78 passed; math/mesh/selection/sdk typecheck passed.
