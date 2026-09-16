# Package audit status

**Baseline:** [`PACKAGE-AUDIT.md`](./PACKAGE-AUDIT.md) (commit `3777e45`, before fixes).  
**Subset session:** [`PROFESSIONAL-WORKFLOW-AUDIT.md`](./PROFESSIONAL-WORKFLOW-AUDIT.md) (selection through interchange).

Status: `OPEN` · `PARTIAL` · `CLOSED` (behavior + tests). `CLOSED` does not mean 1.0-complete for that package.

## Eleven urgent corrections

| # | Original urgent item | Status | Notes |
| --- | --- | --- | --- |
| 1 | History undo/redo/transactions/saved-state failure-safe | CLOSED | Peek-then-commit undo/redo; `stateId` dirty; merge blocked across the saved command; trimmed save points stay dirty via `isSavedStateReachable`. Failed rollback keeps the transaction and `lastFailure` / `pendingTransactionCommands`. Composite execute+rollback failures aggregate `originalCause`. Per-command-family injection remains on `commands`. |
| 2 | Harden `MeshBuilder` and operators | PARTIAL | Duplicate IDs and non-finite verts are rejected; `addFace` has a preflight. Third-face/non-manifold, attribute preservation, and operator-wide transactional insertion are still incomplete. Bevel/n-gon operator tests still fail. |
| 3 | Replace fan triangulation | PARTIAL | Derived `triangulateMesh` / `triangulateFaces` use projected ear clipping. Professional concave corpus, holes, and export/pick proof are not closed. |
| 4 | Planned multi-edge bevel | OPEN | Sequential bevel and percentage offset remain. |
| 5 | Central attribute propagation | OPEN | Operators still copy attributes independently; named UV channels, pins, seams, creases, slots, and weights are not one service. |
| 6 | Object selection, edge rings, marquee, occlusion | PARTIAL | Object-domain mutations and ring walk are closed. Marquee has touch/center/contain + segment/polygon tests. True occlusion (depth buffer / ray) is missing; optional `depth` is only a frontmost-face hint. |
| 7 | Vertex/object pivots and oriented scaling | CLOSED | Vertex world points, mesh AABB bounds, `activeId`, `T R S R⁻¹ T⁻¹`. Multi-object vertex edits and selection-derived normals remain medium gaps. |
| 8 | Paint undo across tiles | CLOSED | Stroke AABB capture; sparse tiles; no full-texture baseline. |
| 9 | One animation schema | OPEN | Document `AnimationClipData` is canonical; legacy `KeyframeTrack` remains. `CUBICSPLINE` is rejected instead of silently lerping. |
| 10 | Real workers | CLOSED | Runtime-neutral `@modeling-kit/workers` (inline). `@modeling-kit/workers/browser` uses `Worker`; `/node` uses `worker_threads`. Bounded queue, result transfer lists, crash replacement, `dispose()` unsubscribe + terminate. Paint/IO jobs are not task types yet. |
| 11 | Package exports and tarball consumers | CLOSED | Public packages export `dist` (`files: ["dist"]`). `pnpm pack:verify` is in `check:release` / CI. Nested `@modeling-kit/*` versions resolve through local tarball `pnpm.overrides`. |

## Phase board (from the original audit)

| Phase | Intent | Status |
| --- | --- | --- |
| 1 State safety | History, dirty identity, group transactions, object selection, paint patches | CLOSED — history failure recovery, document-wide resource snapshots, grouping, selection, paint |
| 2 Kernel correctness | Builder, concave triangulation, validator, attributes, corpus | PARTIAL — builder/triangulator started; validator, attributes, corpus open |
| 3 Modeling behavior | Bevel, rings, marquee, snapping, pivots | PARTIAL — rings/pivots/oriented scale closed; bevel open; marquee/snapping professional gaps remain |
| 4 Assets and animation | Materials, animation schema, skeleton, weights, data-loss reports | PARTIAL — skeleton/weights stricter; glTF reports texture/skin/clip loss; schema unification and texture export open |
| 5 Runtime and distribution | Workers, BVH, WebGL tests, compiled exports, tarball proof | PARTIAL — dist exports, browser/Node workers, and `pack:verify` closed; BVH/WebGL still open |

## Package overlay

Closed in the post-audit fix pass unless noted.

| Package | Closed | Still open from the original |
| --- | --- | --- |
| core | — | ID fallback, listener diagnostics, dirty-batcher limit, lifecycle contract |
| math | — | Negative-scale decompose property tests, singular epsilon, quat normalize |
| mesh | Duplicate IDs; ear-clip derived triangulation | Bevel network, attributes, map encapsulation, invariant corpus |
| validation | — | Guarded raw-record checks, geometric faces, scale-aware tolerance |
| document | Grouping rollback; texture usage index; full-document transaction snapshots | Independent mesh deep-clone; EntityStore mutability |
| history | Peek-then-commit; state-id dirty; partial rollback record; no merge across save; unreachable saved state | — |
| commands | — | Failure injection; stale vertex patches; command ID factory |
| selection | Object domain; ring walk; marquee geometry | Viewport occlusion; vertex/edge visibility |
| snapping | Face-surface; distance+priority bias | Screen-space radius; BVH; construction plane |
| transform | Pivots; oriented scale; activeId | Multi-object vertex path; selection normals |
| input | — | Pointer-cancel buttons; wheel consume; per-pointer delta |
| tools | — | Duplicate register; claim tokens; transactional activate |
| primitives | — | Parameter matrix; complexity budgets |
| materials | — | Canonical schema; immutable library; delete parent |
| uv | Commit hooks; pack validation | Real LSCM/ABF; production packer |
| paint | Long-stroke tiles; sparse capture | Brush validator; flood-fill budgets |
| rigging | Cycles, duplicate IDs, parents, weights, skin collapse | Weight remap after topology; segment-distance weights |
| animation | CUBICSPLINE reject; legacy track validation | Single schema; document-clip validation; Hermite spline |
| formats | Empty mesh skip; STL finite; data-loss strings | Texture/skin/anim export; attribute-aware weld; OBJ UVs |
| workers | Inline + `/browser` + `/node`; host-owned factories; queue; result transfers; crash replace | Dedicated paint/IO jobs. Removed unsafe `defaultComputePool` singleton. |
| three-adapter | — | BVH; demand render; context loss |
| sdk | dist exports; pack:verify in CI | small 1.0 surface |

## Next work (original overlay leftovers)

1. Viewport occlusion for box/lasso (`xray: false`).
2. Canonical animation schema (delete or wrap the legacy sampler).
