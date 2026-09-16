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

Landed (2026-09-16, not the 3× gate):

- Deferred topology bump once per `getMesh()` for procedural builders.
- Nested directed/undirected edge maps (no `vFrom_vTo` strings).
- `skipAreaCheck` on known-planar generator quads (`generateGrid`).
- Skip `Map.has` id scans on a fresh builder.

100k `generateGrid` warmed median moved **3.68 s → 3.15 s** on the same class of machine. The remaining cost is branded string ids and Map records. The ≥3× gate is still open.

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

**Landed 2026-09-16:** `packages/mesh/src/triangulation/fast-path.ts`. 10k warmed median **67 ms → 21 ms** (fan probe ~7.6 ms). 100k **731 ms → 309 ms**. `triangleFaceIds` stay canonical FaceIds.

## Phase C — revision-gated viewport

- In `syncDerivedGeometry`, if topology maps can be reused, **do not** call `triangulateMesh`; copy positions/normals/uvs only.
- Optional dirty-face set (not GPU indices): rebuild tessellation ranges for moved faces only. Blender `loop_triangles`, not a live CDT.

**Landed (whole-mesh refit, not dirty-face set):** `syncDerivedGeometry` takes `topologyRevision` and rewrites attributes without `triangulatePolygon`. Pointer-move previews still commit **one** history command on release.

## Phase D — only if B+C are not enough

- WASM Earcut.hpp / other triangulator behind `TriangulationBackendId`.
- Incremental CDT / dearcut: **reject** unless a new requirement is “edit a 5k-vertex single face in real time”.
- Triangle `three-mesh-bvh`: still optional. First-party `MeshLocalBvh` now indexes derived triangles with topology-revision rebuilds and position-revision refits.

## Non-goals

- Calling `triangulateMesh` on hover, snap, or gizmo tick.
- Caching tessellation **on** `HalfEdgeMesh` as editable truth.
- Minecraft / Blockbench formats.
- Changing PERF-001 isolation: wall-clock asserts stay behind `pnpm test:bench` / `BENCHMARK_ASSERT=1`.
