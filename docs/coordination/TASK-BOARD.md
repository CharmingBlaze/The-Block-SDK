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
| R1-T014 | Primitive-geometry adapter | VERIFIED | `@modeling-kit/primitives` (+ commands/three-adapter tests) | `tasks/R1-T014.md` |
| R1-T015 | Earcut triangulation backend | VERIFIED | `@modeling-kit/mesh` | `tasks/R1-T015.md` |
| R1-T016 | geometry-extrude profile adapter | VERIFIED | `@modeling-kit/primitives` (+ commands/tools) | `tasks/R1-T016.md` |
| R1-T017 | meshoptimizer derived-triangle adapter | VERIFIED | `@modeling-kit/meshopt` | `tasks/R1-T017.md` |

## Phase 2 — Correctness foundation (Sol 3D / ViperCAD hardening)

Sourced from Sol 3D architecture review. Implement in order; each unblocks the next.

| Task ID | Title | State | Allowed packages | Packet |
| ------- | ----- | ----- | ---------------- | ------ |
| R2-T001 | Mesh invariant hardening — `validateMeshInvariants`, raw-record loop checks, dev-mode post-op injection | DRAFT | `@modeling-kit/validation`, `@modeling-kit/mesh` (internal/assert-mesh only) | `tasks/R2-T001.md` |
| R2-T002 | MeshBuilder atomic rollback — staged insertion, all-or-nothing commit, rollback on mid-insertion error | DRAFT | `@modeling-kit/mesh` (builder.ts only) | `tasks/R2-T002.md` |
| R2-T003 | Attribute propagation service — `AttributePropagationService`, `AttributePolicy` per operator, migrate bevel/extrude/inset/loop-cut | DRAFT | `@modeling-kit/mesh` (internal + operations) | `tasks/R2-T003.md` |
| R2-T004 | Triangulation fixture corpus — arrow, L, star, thin, collinear, reversed, large-coord, near-degenerate; per-triangle assertion helpers | DRAFT | `@modeling-kit/mesh` | `tasks/R2-T004.md` |
| R2-T005 | Animation schema unification — single `AnimationClipData` canonical form, legacy `KeyframeTrack` becomes adapter only, structured `DataLossReport` | DRAFT | `@modeling-kit/animation` | `tasks/R2-T005.md` |

**Phase 2 constraint:** Do not start R2-T003 until R2-T001 and R2-T002 are VERIFIED. Do not start R2-T004 until R2-T001 is VERIFIED.

## Release

Tag-triggered npm publish is in `.github/workflows/release.yml`. First public version is still `0.1.0` until `NPM_TOKEN` exists and `v0.1.0` is pushed. Exact-commit CI is green on `5a3d941` ([run 35063242733](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35063242733)). Guide: `docs/guides/publishing.md`.

## Backlog

The non-deferred 1.0 matrix is closed (`docs/verification/RELEASE-1.0-EVIDENCE.md`). Remaining product work is **1.1 / later**, not new 1.0 packets:

- Boolean CSG (`BOOL-001`)
- LSCM/ABF unwrap
- GPU hover, `InstancedMesh` picking, GPU-skinned picking, advanced transparency
- Rigging/animation **authoring** (IK, weight painting, NLA)
- PLY codec
- Optional triangle `three-mesh-bvh` host backend (object AABB `BvhSpatialQuery` plus first-party `MeshLocalBvh` are in)
- `generateGrid` 3× spawn cost (tessellation fast path and revision-gated viewport already landed)

Release remaining: add GitHub secret `NPM_TOKEN`, then `git tag v0.1.0 && git push origin v0.1.0`. Exact-commit CI is green on `5a3d941` ([run 35063242733](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35063242733)). Guide: `docs/guides/publishing.md`.

Do not start a new Antigravity packet without a task file.

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
- R1-T014 — 2026-09-16. `primitive-geometry` behind `convertSimplicialComplex`. Library recipes convert to HalfEdgeMesh; catalog cube/uvSphere unchanged. Packed-cell IR stays inside primitives; formats keep native importers.
- R1-T015 — 2026-09-16. `earcut` behind `triangulatePolygonLoops`. Convex faces stay ear-clipped; holes/concave use Earcut with validation.
- R1-T016 — 2026-09-16. `geometry-extrude` behind `generateProfileExtrude`. Catalog `wall` and `extrudeFaces` unchanged. Focused tests 26+ passed; primitives/commands/tools/sdk typecheck passed.
- R1-T017 — 2026-09-16. `meshoptimizer` behind `optimizeDerivedTriangles` in `@modeling-kit/meshopt`. Half-edge kernel unchanged.
