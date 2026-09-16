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

1. Reject non-finite coordinates.
2. Collapse near-duplicates / near-collinear vertices (`epsilon`).
3. Build a stable 3D-to-2D frame from the outer Newell normal (`projectPointToOrientedPlane2d`).
4. Normalize outer winding to CCW in that frame; holes to CW.
5. Reject self-intersections when `rejectSelfIntersecting` is true (default).
6. Triangulate.
7. Validate index ranges, non-zero triangle area, winding, area vs source, and that every loop edge appears in the mesh.

Suspicious Earcut output is `status: "failed"` with zero triangles. `triangulateFaces` still throws on non-ok status.

## Indices

`triangles` and `sourceVertexIndices` are indices into the caller’s outer ring, then each hole in order (`outer.length` offset). Existing no-hole callers still index into `points`.

## Performance

Earcut is one typed-array pass. No WASM, workers, or result cache. Degenerate input fails closed; it does not mutate the kernel.
