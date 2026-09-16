# Primitive topology

modeling-kit is **quad-first**, not all-quads. Canonical editable primitives are generated through `MeshBuilder` with intentional face composition. `primitive-geometry` remains available as a triangulated import/reference path. It is not the source of canonical quad topology.

## Two pipelines

1. **Canonical generators** (`generateBox`, `generateUvSphere`, `generateQuadSphere`, …) build modeling topology: shared vertices, per-corner UVs and normals, UV seams that do not split editable vertices.
2. **Library adapter** (`convertSimplicialComplex`) imports `primitive-geometry` `cells` as **triangles** unless the caller supplies explicit `cellSize` metadata. Index-buffer length is never used to guess quads vs triangles.

Rendering (`triangulateMesh` → Three.js `BufferGeometry`) triangulates canonical faces and maps each render triangle back to a canonical `FaceId`. Render vertices split when position, UV, or normal differs.

## Canonical face composition

| Primitive | Topology |
| --- | --- |
| Cube / box (default) | 6 quads |
| Subdivided cube | only quads |
| Plane / grid / quad / rectangle | only quads |
| Quad sphere | cube grid projected onto a sphere; only non-degenerate quads; no poles |
| Torus | only quads |
| Cylinder | quad side walls; n-gon caps |
| Capsule | quad bands; triangle pole caps |
| UV sphere | quad bands; triangle pole caps |
| Cone | quad bands where possible; triangles at the apex |
| Rounded cube | quad face, edge, and corner patches |
| Icosphere / tetrahedron / icosahedron | triangles by design |

Do not fabricate quads by repeating a pole vertex or by pairing arbitrary render triangles.

## Spheres

- `uvSphere` (also `spawn.sphere`) keeps conventional latitude/longitude UVs and mixed topology.
- `quadSphere` is the all-quad modeling sphere: six welded cube grids projected onto the requested radius, cube-atlas UVs, smooth radial corner normals, UV seams on cube-face boundaries.

## Library usage

Keep primitive-geometry for unsupported or render-oriented shapes, visual comparison, previews, UV/normal regression, and `generateLibraryPrimitive`. Canonical catalog entries for cube, plane, cylinder, torus, capsule, UV sphere, quad sphere, and rounded cube use the SDK builders.
