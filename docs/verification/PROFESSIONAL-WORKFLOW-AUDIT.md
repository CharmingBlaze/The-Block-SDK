# Professional workflow audit

**Date:** 2026-09-16  
**Scope:** Selection, snapping, transforms, grouping, resources, paint, UVs, rigging, animation, and interchange.  
**Out of scope here:** History/command failure paths, n-gon triangulation, bevel quality, worker offloading, and public package distribution (already identified separately).

Status values: `CONFIRMED` (bug matches source) · `FIXED` (behavior + tests in this pass) · `PARTIAL` (mitigated, not professional-complete) · `DEFERRED` (needs viewport/export architecture).

The SDK remains usable for controlled demos and simple meshes. It does not yet behave correctly across professional modeling workflows.

## Findings

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Object `add`/`remove`/`toggle` mutate `elementIds` | FIXED | `packages/selection/src/manager.ts` |
| 2 | Edge ring walks only one opposite edge | FIXED | `packages/selection/src/topology.ts`; ring walk in `packages/mesh/src/operations/loop-cut.ts` |
| 3 | Box select is vertex-in-rect only | PARTIAL | Touch mode now uses segment/polygon tests + containment modes. Center and fully-contained work. True occlusion is still missing. |
| 4 | Non-x-ray box select is map-order, not visibility | PARTIAL | Early `break` removed. Optional `depth` keeps the frontmost face. No depth buffer / ray occlusion. |
| 5 | Lasso ignores `xray` | PARTIAL | Lasso honors `xray` + optional `depth` the same way as box select. Still no occlusion query. |
| 6 | Face snap is centroid-only | FIXED | `face` = center; `surface` / `face-surface` = closest point on fan triangles. |
| 7 | Priority-before-distance snap | FIXED | Normalized distance minus priority bias. Still world-space (zoom-variant) without a projection hook. |
| 8 | Vertex pivots use object origins | FIXED | Vertex gestures pivot from selected vertex world positions. |
| 9 | Bounds pivot uses origins | FIXED | Bounds unions world-space mesh AABBs when meshes are supplied. |
| 10 | Active pivot ignores `activeId` | FIXED | `TransformRequest.activeId` / selection `activeId`. |
| 11 | Scale ignores transform space | FIXED | `T(p) R(space) S R⁻¹ T(-p)`. |
| 12 | `groupNodes` / `ungroupNode` are not transactional | FIXED | Validate first; roll back partial reparents. |
| 13 | Unused-texture scan misses bindings/sets | FIXED | `textureBindings` and texture-set channels counted. |
| 14 | Long paint strokes omit intermediate tiles | FIXED | Stroke AABB captured before rasterize. |
| 15 | Every stroke copies the full texture | FIXED | No full baseline; sparse tiles only. |
| 16 | UV `onCommit` restores before observers | FIXED | `onCommit` remains command-apply (restore then apply). `onCommitted` notifies without restoring. |
| 17 | `packUvs` lacks input validation | FIXED | Rejects non-finite/negative padding, non-finite UVs; pinned/rotation throw. |
| 18 | Two animation schemas | DEFERRED | Document `AnimationClipData` is canonical. Legacy `KeyframeTrack` remains for glTF-shaped clips. Unification is a separate schema task. |
| 19 | `CUBICSPLINE` silently lerps | FIXED | `sampleTrack` rejects unsupported interpolation. |
| 20 | Animation tracks unvalidated | PARTIAL | Legacy sampler validates times, sort, uniqueness, and value length. Document clips still trust stored keys. |
| 21 | Skeleton cycles can yield empty bones | FIXED | DFS cycle check; build fails closed. |
| 22 | Duplicate bone IDs overwrite | FIXED | `addBone` rejects duplicates. |
| 23 | Missing bone parents become roots | FIXED | Strict reject; no silent detach. |
| 24 | `reparentBone` skips missing IDs | FIXED | Both IDs must exist. |
| 25 | Weight normalize accepts invalid input | FIXED | Rejects negative/NaN/Inf, `maxInfluences <= 0`; merges duplicate bones. |
| 26 | Invalid influences collapse to origin | FIXED | Renormalize valid influences; keep rest if none valid. |
| 27 | glTF export drops textures | DEFERRED | Report records texture loss. Full image/sampler/texture export is not in this pass. |
| 28 | glTF export drops animation/skinning | DEFERRED | Report records the loss. README no longer implies complete interchange. |
| 29 | Empty mesh POSITION min/max non-finite | FIXED | Empty meshes skipped; no invalid accessors. |
| 30 | STL accepts NaN / extra facet verts | FIXED | Non-finite verts skipped; extra vertices warned, first three used. |

## Readiness (updated)

| System | Status |
| --- | --- |
| Math foundation | Generally sound |
| Basic document hierarchy | Usable; grouping now validate-then-commit |
| Basic half-edge topology | Promising |
| Simple primitives | Usable |
| Basic command workflow | Usable on success paths |
| Object selection | Domain-aware add/remove/toggle |
| Edge rings | Quad ring walk (boundary / non-quad / visited / close) |
| Occlusion-aware marquee | Still missing; optional depth only |
| Professional snapping | Face-surface + weighted priority; no screen-space radius yet |
| Vertex / bounds / active pivots | Object AABBs and vertex world points |
| Local/view/normal scaling | Oriented scale |
| Paint undo / large textures | Sparse tiles; long-stroke AABB |
| UV editing | Foundation + safer commit hooks + pack validation |
| Rigging | Stricter construction; still preview-quality evaluation |
| Animation | Canonical document clips vs legacy sampler; spline rejected |
| glTF asset interchange | Geometry + hierarchy + PBR factors; no textures/skins/clips |
| Worker offloading | Not implemented for these paths |
| Public package distribution | Unchanged / previously identified |

## Remaining professional gaps

1. Viewport-provided depth buffer or ray samples for true non-x-ray marquee/lasso.
2. Screen-space snap radius, per-type max distance, and tool-intent weights.
3. One animation schema (`AnimationClipData`) consumed by evaluation, players, and glTF.
4. glTF images, samplers, textures, skins, joints, and animations.
5. Document-clip track validation equivalent to the legacy sampler checks.
