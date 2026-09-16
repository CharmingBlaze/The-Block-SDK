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
