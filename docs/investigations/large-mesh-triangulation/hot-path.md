# Current hot path

`triangulateMesh` is a full-mesh derived rebuild. The adapter calls it on every kernel revision before it even checks whether GPU buffers can be reused.

## Call graph (render / export / pick)

```text
syncDerivedGeometry / export glTF / pick refinement / triangulateAsync
  └─ triangulateMesh                    packages/mesh/src/triangulate.ts
       per face:
         getFaceVertices + getFaceCorners   each walkFace allocates Set<HalfEdgeId>
         new Vector3 per corner             then immediately `.map` back to tuples
         triangulatePolygon                 packages/mesh/src/triangulation/loops.ts
         Newell normal again (Vector3.add loop)
         push into JS number[] / id[]
       then copy into Float32Array / Uint32Array
```

Grid construction is **outside** the 0.1 bench timer, but it is part of user-visible “make a large mesh” cost. `MeshBuilder.addFace` also runs `polygonArea` (cheap Newell) and allocates half-edge records with string ids (`v_1`, `he_1`, …).

## Per convex quad, `triangulatePolygon` currently

1. Finite-coordinate scan  
2. Collapse near-duplicates / collinear — **including `isCollinear3d`** (three `orient2d` calls) per remaining vertex  
3. `polygonSelfIntersects3d` (project to XY/XZ/YZ, then segment tests)  
4. Newell unit normal + plane deviation  
5. Project to oriented 2D  
6. `polygonSelfIntersects` again  
7. Winding flip  
8. `polygonSelfIntersects` a **third** time  
9. `isConvexCCW` to pick earclip vs Earcut  
10. `clipEars` + area validation + `boundaryEdgesRepresented` (`Set` of `"a:b"` strings)

Holes and concave faces should keep this. A 100×100 **grid of planar quads** pays it 10,000 times.

`backend: "auto"` will choose earclip for convex quads. Earcut is not the inner loop on the PERF-001 fixture.

## Adapter reuse bug (interactive)

`syncDerivedGeometry` always triangulates, **then** compares FaceId/VertexId maps to reuse `BufferGeometry`. A vertex drag that bumps `kernel.revision` still retessellates every face. 1.1 should compare revision / topology fingerprint **before** `triangulateMesh`, and for position-only edits rewrite `position` (and maybe normals) without re-earclipping.

Workers (`triangulateAsync`) already exist for commit-time full rebuilds. They do not fix per-face JS cost; they only move it off the pointer thread.

## Why 0.1 numbers look “too slow for Earcut”

Mapbox’s published tile batch is ~0.2 µs–few µs per small polygon. 2.67 s / 10,000 quads = **267 µs per quad**. That is two orders of magnitude above a 4-point ear clip. The budget is being spent on predicates, three self-intersection passes, Vector3, Map walks, and growable JS arrays.
