# Polygon triangulation

**Owning package:** `@modeling-kit/mesh`  
**Library:** `earcut` 3.0.2 (ISC), used only behind `triangulatePolygon`

The half-edge mesh still stores n-gons. Triangulation is derived: render, picking (`triangleFaceIds`), glTF, and in-kernel `triangulateFaces`. There is no second mesh.

## Ownership

| Layer | Owns |
| --- | --- |
| Ear clipper | Convex simple loops, same winding as before |
| Earcut | Concave boundaries, holes, multiple loops, extruded caps |
| `triangulatePolygon` | Projection, validation, backend choice, original-vertex indices |
| `GeometryTolerance` / predicates | Collapse epsilon vs orientation signs |

Static conversion has no state machine and no cache.

## When Earcut runs

`backend: "auto"` (default):

- Convex outer loop, no holes → ear clip
- Concave, holes, or extra loops → Earcut
- If Earcut fails on a simple polygon, the clipper is tried once

Force a backend with `{ backend: "earcut" | "earclip" }`. Holes always use Earcut.

## Pipeline

1. Reject non-finite coordinates (throws).
2. Collapse near-duplicates / near-collinear vertices (`epsilon`).
3. Reject self-intersections in the largest-extent axis plane (XY / XZ / YZ). Signed area is not used here: a bowtie has ~0 signed area and a slightly non-planar XZ bowtie can have a Newell normal of ±Z, which would hide the crossing.
4. Build a 3D-to-2D frame from the outer Newell normal (`projectPointToOrientedPlane2d`) for triangulation.
5. Normalize outer winding to CCW in that frame; holes to CW.
6. Reject remaining self-intersections in the Newell frame when `rejectSelfIntersecting` is true (default).
7. Triangulate.
8. Validate index ranges, non-zero triangle area, winding, area vs source, and that every loop edge appears in the mesh.

Suspicious Earcut output is `status: "failed"` with zero triangles. A simple no-hole polygon that still cannot be triangulated is `self-intersecting` so `triangulateFaces` keeps throwing `/self-intersecting/`. Holes that fail stay `failed`.

## Indices

`triangles` and `sourceVertexIndices` are indices into the caller’s outer ring, then each hole in order (`outer.length` offset). Existing no-hole callers still index into `points`.

## Performance

Earcut is one typed-array pass. No WASM, workers, or result cache. Degenerate input fails closed; it does not mutate the kernel.

Earcut is not a file importer. glTF/OBJ/STL enter through `@modeling-kit/formats`. `triangulateMesh` may then dump n-gons to triangles for render or export.

### Interactive limits (0.1)

`triangulateMesh` rebuilds derived triangles for the whole mesh. That is a batch / commit cost, not a pointer-move budget. Do not call it on every hover, snap, or gizmo tick. Hosts should keep it behind revision-gated viewport sync or `@modeling-kit/workers` (`triangulateAsync`).

Kernel triangles and convex planar quads use a fixed split (`(0,1,2)` / `(0,1,2)+(0,2,3)`). Concave n-gons and holes still go through `triangulatePolygon` / Earcut. `syncDerivedGeometry` copies positions, normals, and UVs when `topologyRevision` is unchanged and does not retessellate.

Observed samples from the 2026-09-16 re-audit (shared-load machine, not CI). These are **single wall-clock shots**, not warmed medians:

| Work | Size | Wall clock |
| --- | --- | --- |
| `triangulateMesh` grid | ~10k vertices (`segments` 100×100) | 2.67 s |
| `triangulateMesh` grid | ~100k vertices (`segments` 316×316) | 18.9 s |
| Native serialize | 1,000 scene nodes | 347 ms |

Warmed medians from `pnpm bench:triangulation` (Ryzen 7 250, Node 26, 2026-09-16, after the 1.1 fast path): `generateGrid` 232 ms / 3.15 s; `triangulateMesh` 21 ms / 309 ms. Full tables: `docs/investigations/large-mesh-triangulation/samples.md`.

Optional `BENCHMARK_ASSERT=1` budgets in `triangulation.bench.test.ts` are looser (10k < 4 s, 100k < 30 s) so CI does not flake. Those budgets are not interactive targets.

Grid construction is still the large-mesh kernel cost (string-keyed Maps). Object AABB `BvhSpatialQuery` plus mesh-local `MeshLocalBvh` (topology rebuild, position refit) are the spatial layers. Triangle `three-mesh-bvh` remains an optional host backend.
