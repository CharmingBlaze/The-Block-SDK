# 1.1 plan

Do not treat this as a 0.1 patch. Interactive limits in `docs/guides/triangulation.md` stay honest until a phase lands with recorded medians.

## Phase A — measure (landed 2026-09-16)

- [x] Modular profiler under `scripts/bench/triangulation/`
- [x] Warmed medians: `generateGrid` vs `triangulateMesh` at 10k and 100k
- [x] Stage breakdown on 10k
- [x] Heap deltas with `--expose-gc`
- [x] Report in [samples.md](./samples.md)

**Result:** the 0.1 2.67 s / 18.9 s figures are noisy one-shots. Warmed `triangulateMesh` is **67 ms / 731 ms**. **`generateGrid` is 246 ms / 3.68 s** — that is the large-mesh wall clock. See samples.

## Phase B — two separate costs

Do not file “make Earcut faster” as the 100k task. Split the work:

### B1 — `generateGrid` / `MeshBuilder` (owns 100k)

Suspects: per-face `addFace` (string ids, four Maps, `polygonArea`, `bumpRevision`), `walkBudget`, directed-edge string keys.

Possible modular changes (no new deps):

- Batch revision bump once per primitive, not per face.
- Skip zero-area Newell in generators that already emit known-planar quads (keep the check on the public `addFace` API).
- Reuse key buffers for `vFrom_vTo` instead of interpolating a new string per edge.

Do **not** replace branded string ids with array indices (architecture invariant). Integer-looking prefixes (`v_1`) are already sequential; the cost is Map/string traffic.

**Done when:** 100k `generateGrid` warmed median drops by **≥3×** on the same class of machine, topology tests still pass.

### B2 — derived tessellation (owns pointer-rate rebuilds)

Keep Earcut for concave / holes. Add a **modular** fast path next to existing backends (do not grow `loops.ts` into a god file):

| Fast path | When | Model |
| --- | --- | --- |
| Identity triangle | face length 3 | Blender `len == 3` |
| Fixed quad split | convex planar quad | Blender `use_fixed_quad` `(0,1,2)+(0,2,3)` |
| Existing earclip / Earcut | concave, holes, n>4, or convexity fails | current `choose.ts` |

Also in `triangulateMesh` only:

- Stop allocating `Vector3` to immediately tuple-ize.
- Walk each face **once** (vertices + corners).
- Pre-size output arrays from `faces.size`.

Public `triangulatePolygon` keeps self-intersection tests. Kernel faces that were validated at insert can skip the triplicate self-intersect passes.

**Done when:** 10k grid `triangulateMesh` warmed median is within ~2× of the fan probe (~5 ms → target ≤15 ms), `packages/mesh/tests/earcut-*.ts` pass, `triangleFaceIds` stay canonical FaceIds.

## Phase C — revision-gated viewport

- In `syncDerivedGeometry`, if topology maps can be reused, **do not** call `triangulateMesh`; copy positions/normals/uvs only.
- Optional dirty-face set (not GPU indices): rebuild tessellation ranges for moved faces only. Blender `loop_triangles`, not a live CDT.

**Done when:** a vertex translate on a 10k grid does not re-run `triangulatePolygon` for untouched faces. Pointer-move previews still commit **one** history command on release.

## Phase D — only if B+C are not enough

- WASM Earcut.hpp / other triangulator behind `TriangulationBackendId`.
- Incremental CDT / dearcut: **reject** unless a new requirement is “edit a 5k-vertex single face in real time”.
- Triangle `three-mesh-bvh`: already deferred; object AABB BVH is 1.0.

## Non-goals

- Calling `triangulateMesh` on hover, snap, or gizmo tick.
- Caching tessellation **on** `HalfEdgeMesh` as editable truth.
- Minecraft / Blockbench formats.
- Changing PERF-001 isolation: wall-clock asserts stay behind `pnpm test:bench` / `BENCHMARK_ASSERT=1`.
