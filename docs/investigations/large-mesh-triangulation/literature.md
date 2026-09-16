# Literature (derived n-gon tessellation)

Sources checked 2026-09-16. None of these replace the mesh kernel. They inform **where** to spend 1.1 time.

## Mapbox Earcut — the library we already use

- Repo: [mapbox/earcut](https://github.com/mapbox/earcut)
- Designed for **many small 2D polygons** (vector tiles), not one huge n-gon and not a 3D half-edge kernel.
- Published workload: **119,680 polygons / 1.9M vertices in ~445 ms** on an M1 Pro (optional Delaunay refine +168 ms).
- Old Node 0.12 table: a 15-point building is ~796k ops/s; a 5,667-point water poly is ~95 ops/s.
- **Assumes valid input.** Self-intersections, duplicates, and holes-outside-outer are not guaranteed correct. The README says: if correctness matters, clean input first; use libtess.js if you need a guaranteed tessellator on bad data.
- 3D is “ignore Z / project to 2D”. That matches our Newell-plane projection.

Implication: 10,000 **quads** should be a few tens of milliseconds in Earcut itself. A 2.67 s `triangulateMesh` on that grid is almost certainly **wrapper + validation + kernel walks + allocations**, not Earcut.

C++ port ([earcut.hpp](https://github.com/mapbox/earcut.hpp)): z-order hashing kicks in above ~80 vertices; tiny contours skip it. Cache-friendly triangle structs helped the C++ port, not JS. Our faces are 4-gons, so hashing is irrelevant.

## Tiny-polygon / zero-alloc ear clipping

[Earcut64](https://dev.to/nail_sharipov_5d810d8cf71/earcut64-zero-allocation-triangulation-for-tiny-polygons-511j) (iTriangle / Nail Sharipov): for ≤64 vertices, keep the contour in registers/bitmasks, no heap. Takeaway for us: **the hot mesh is thousands of 4-vertex faces**. A general n-gon pipeline that allocates per face will lose to a quad fan even if Earcut is “fast”.

Do **not** vendor iTriangle or Earcut64. Integer/WASM backends are a later option if the TS fast path is still short.

## Blender BMesh — derived loop triangles

Public API (not source we copy):

- BMesh does **not** store tessellation. Object-mode `Mesh.loop_triangles` is a derived cache. Edit scripts call `mesh.calc_loop_triangles()` or `bmesh.update_edit_mesh(..., loop_triangles=True)`.
- `BM_face_calc_tessellation` (documented behavior, independent of GPL implementation details):
  - **len == 3:** identity
  - **len == 4 and `use_fixed_quad`:** split `(0,1,2)` + `(0,2,3)`
  - **else:** project to the dominant plane and polyfill

That is the same layering we want: kernel n-gons stay n-gons; tessellation is derived; quads get a trivial split; concave n-gons pay for a real triangulator.

Dirty-face / incremental tessellation in Blender is “rebuild loop_triangles when the mesh updates”, not a CDT that inserts one vertex into a live triangle mesh.

## Incremental CDT / dynamic Earcut — usually the wrong tool

- [Kallmann et al., fully dynamic constrained Delaunay](https://infoscience.epfl.ch/nanna/record/100269/files/Kallmann_and_al_Geometric_Modeling_03.pdf): insert/remove constraint segments in a live triangulation. Right for GIS/path planning, not for dumping n-gons to render buffers.
- [dearcut](https://codeberg.org/topola/dearcut): incremental Earcut in Rust, explicitly **untested and unoptimized**. Do not depend on it.

## How to measure (Vitest / Node)

- Vitest [benchmarking](https://vitest.dev/guide/benchmarking.html): interleaved iterations, median. Too heavy for a 19 s 100k sample if we ask for dozens of iterations.
- Custom warmed median: discard 1 warmup, take 3–5 `performance.now()` samples, report **median** (0.1 docs already warn that a single wall-clock on a shared-load machine is not a budget).
- Memory: Node `--expose-gc`, force GC, compare `process.memoryUsage().heapUsed` after each phase. Peak-during-op is not the same as retained heap; report both if GC is missing.

## What we will not do

- Swap Earcut for libtess.js “for speed” (libtess is the slow/correct option).
- Treat Three.js `BufferGeometry` as editable truth (risk R3 in `docs/research/risk-register.md` is a different R3).
- Copy Blockbench or Blender tessellation source.
