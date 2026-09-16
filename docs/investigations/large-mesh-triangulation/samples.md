# Samples

**Machine:** win32 x64 AMD Ryzen 7 250 w/ Radeon 780M Graphics  
**Node:** v26.3.0  
**Date:** 2026-09-16  
**Command:** `BENCH_LARGE=1 pnpm bench:triangulation` (`--expose-gc`)  
**Method:** 1 discarded warmup; 10k = 5 samples, 100k = 3 samples; times are warmed medians.

The 0.1 guide numbers (2.67 s / 18.9 s) were **single wall-clock samples on a shared-load machine**. They are not warmed medians. On this run, `triangulateMesh` is about **40× / 26× faster** than those one-shots. **Grid construction is the large-mesh cost.**

## Grid vs triangulateMesh

| Work | Size | Vertices | Faces | Warmed median | Cold (first timed) |
| --- | --- | ---: | ---: | ---: | ---: |
| `generateGrid` | 100×100 | 10,201 | 10,000 | 246 ms | 249 ms |
| `triangulateMesh` | 100×100 | 10,201 | 10,000 | 67 ms | 68 ms |
| `generateGrid` | 316×316 | 100,489 | 99,856 | 3.68 s | 3.48 s |
| `triangulateMesh` | 316×316 | 100,489 | 99,856 | 731 ms | 751 ms |

10× vertices → grid **15×** slower (superlinear Maps), triangulate **11×** (near-linear).

## 10k stage breakdown (same mesh)

| Stage | Warmed median |
| --- | ---: |
| `walkFace` vertices + corners | 7.2 ms |
| copy position tuples | 8.2 ms |
| copy `Vector3` (current `triangulateMesh`) | 8.5 ms |
| fan tessellate (no predicates) | 4.9 ms |
| `triangulatePolygon` `rejectSelfIntersecting=false` | 36.4 ms |
| `triangulatePolygon` `rejectSelfIntersecting=true` | 40.9 ms |
| full `triangulateMesh` | 63.7 ms |

Self-intersection rejection is a few milliseconds on quads. The polygon facade (collapse, project, convexity, earclip, area check) is ~8× a fixed quad fan. Buffer packing after `triangulatePolygon` is ~20 ms.

## Memory (`heapUsed` after GC)

| Phase | 10k | 100k |
| --- | ---: | ---: |
| after `generateGrid` (delta) | +17.7 MiB | +167.0 MiB |
| after `triangulateMesh` (delta) | +1.0 MiB | +10.8 MiB |

Derived typed arrays are cheap. The kernel (string-keyed Maps of vertices/half-edges/faces/corners) is the retained cost. Dropping the mesh in-process did **not** return that heap; branded string ids stay interned for the process lifetime. 100k baseline was already 209 MiB because the 10k pass ran first in the same Node process.
