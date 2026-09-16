# Approved dependency policy

Use a small, deliberate stack. There is no complete TypeScript library that already provides professional editable topology, primitives, UVs, selections, bevels, loop cuts, undo, rigging, and Three.js rendering correctly. **This SDK’s canonical work stays in our packages.** Third-party code is only for derived work (triangulation, predicates, viewport acceleration, interchange processing).

This document is adapted to modeling-kit as it exists today. Do not restart the kernel, math, or commands to chase a “perfect” stack. glTF/GLB interchange in `@modeling-kit/formats` uses glTF Transform (see the 10-point review in `docs/research/provenance-log.md`).

## Already true here (do not reverse)

| Decision | Status |
| -------- | ------ |
| Half-edge mesh with branded IDs, quads, corners, seams | `@modeling-kit/mesh` |
| Structural math in the kernel; Three.js only at the viewport | `@modeling-kit/math` vs `@modeling-kit/three-adapter` |
| `THREE.BufferGeometry` is derived, never editable | adapter `geometry.ts` |
| Cube is six quads (8 / 12 / 6), render dump is 12 triangles | `MeshBuilder` / `generateBox` |
| Commands + exact undo | `@modeling-kit/commands` + `@modeling-kit/history` |
| Native JSON vs delivery glTF | `serializeDocument` vs `@modeling-kit/formats` |
| Headless input actions/gestures; DOM is a separate export | `@modeling-kit/input` vs `@modeling-kit/input/dom` |

Do **not** make Three.js primitive geometries (`BoxGeometry`, etc.) canonical. Do **not** make a glTF Transform document the editor document.

## Approved now (install only when wrapping an interface)

| Package | Role | Where it may live | When |
| ------- | ---- | ----------------- | ---- |
| `vitest` | Unit tests | repo root (already) | Now |
| `three` | Viewport, cameras, materials, derived BufferGeometry | **peer** of `three-adapter` and host apps only | Already |
| `earcut` | N-gon → derived triangles (render, pick, glTF, area) | `@modeling-kit/mesh` behind `triangulatePolygon` / `triangulatePolygonLoops` | **Added 2026-09-16.** Convex no-hole faces stay on ear-clip. See `docs/guides/triangulation.md`. |
| `robust-predicates` | `orient2d` / `orient3d` | `@modeling-kit/math` behind `GeometryPredicates` | **Added 2026-09-16.** Sign/orientation only; distances stay on `GeometryTolerance`. See `docs/guides/geometry-predicates.md`. |
| `zod` | Native JSON, tool params, clipboard, worker messages | `@modeling-kit/document` (and formats IO) | After a schema is frozen; do not Zod every vector op |
| `fast-check` | Property tests (undo fingerprints, validity) | devDependency | After one generator is stable |
| `primitive-geometry` | Typed-array geometry recipes (positions/normals/UVs/cells) | `@modeling-kit/primitives` behind `convertSimplicialComplex` | 2026-09-16. Canonical primitives use `MeshBuilder`. Library `cells` are triangles unless `cellSize` is explicit. See `docs/architecture/primitive-topology.md`. |
| `geometry-extrude` | 2D profile / path → triangle soup | `@modeling-kit/primitives` behind `generateProfileExtrude` | **Added 2026-09-16.** Does not replace `extrudeFaces` or catalog `wall`. XY+Z remaps to SDK XZ ground / +Y height. See `docs/guides/profile-extrude.md`. |
| `meshoptimizer` | Vertex-cache/fetch reorder and controlled LOD on **derived** triangles | `@modeling-kit/meshopt` behind `optimizeDerivedTriangles` | **Added 2026-09-16.** Never mutates HalfEdgeMesh. Not a required `@modeling-kit/sdk` dependency. See `docs/guides/meshopt.md`. |
| `watlas` | Automatic chart unwrap (xatlas WASM) | `@modeling-kit/uv` behind `UvUnwrapBackend` / `automaticUnwrap` | **Added 2026-09-16.** Do not expose watlas or xatlas objects. Not LSCM or ABF++. See `docs/architecture/AUTOMATIC-UV-UNWRAP.md`. |

## Approved later, optional adapter packages only

| Package | Adapter | Gate |
| ------- | ------- | ---- |
| `three-mesh-bvh` | optional peer of `three-adapter` as `SpatialQueryBackend` | Picking/lasso on large meshes; dirty levels, not rebuild every pointer move |
| `manifold-3d` | `@modeling-kit/booleans-manifold` as `BooleanBackend` | After kernel, selection, extrusion, undo, save/load (already passing) **and** a conversion-report design |
| `@gltf-transform/core` + `@gltf-transform/extensions` | **canonical** glTF/GLB read/write inside `@modeling-kit/formats` | **Added 2026-09-16.** Transform documents are internal. Public APIs stay `importGltf` / `exportGltf` / `exportGlb`. Do not add `@gltf-transform/functions`, sharp, Draco, or KTX to the base package. See `docs/architecture/decisions/GLTF-TRANSFORM-BACKEND.md`. |
| `comlink` | workers | If postMessage friction is measured |

Keep Manifold, glTF Transform, and Comlink **out of** `@modeling-kit/mesh` and `@modeling-kit/document`. glTF Transform is a required dependency of `@modeling-kit/formats` only — not of `@modeling-kit/sdk` (sdk re-exports formats APIs). `meshoptimizer` lives only in `@modeling-kit/meshopt`.

`@modeling-kit/formats` does not depend on `@modeling-kit/primitives` or `primitive-geometry`. OBJ/glTF/STL already declare faces or triangle primitives; they go through `MeshBuilder` in the formats package. Packed `cells` + `cellSize` is only for recipe libraries. Hosts that need both a catalog cube and a glTF cube call `generateBox` / `importGltf` separately — they do not share an IR.

## Forbidden until a 10-point review is logged

OpenCascade.js, CGAL ports, extra math libraries (gl-matrix next to Three.js), extra Boolean libraries, ECS/reactive cores, a second renderer, a plugin framework before the public API stabilizes, GPU compute for basic topology, full B-rep CAD.

New geometry/math/state/format libraries require, in `docs/research/provenance-log.md`:

1. Problem  
2. Why the current stack cannot do it  
3. Bundle-size cost  
4. Runtime cost  
5. Licence  
6. Maintenance  
7. Browser and Node compatibility  
8. Whether the canonical data model changes  
9. Abstraction that prevents lock-in  
10. Tests for the integration  

## Backend interfaces (commands never import optional backends)

- `TriangulationBackend` — Earcut (or the current fan) for **derived** triangles; n-gons stay in the kernel  
- `GeometryPredicates` — wrap `robust-predicates`  
- `SpatialQueryBackend` — wrap `three-mesh-bvh` in the adapter  
- `BooleanBackend` — wrap Manifold; result includes warnings and discarded attributes  
- `GltfBackend` — `@modeling-kit/formats` is the implementation; glTF Transform is the codec, not the editor document  
- `MeshOptimizationBackend` — meshoptimizer on export triangles only  
- `UvUnwrapBackend` — watlas/xatlas automatic chart unwrap; future exact LSCM/ABF++ backends may implement the same interface  

## First primitive bar (box)

Exactly 8 vertices, 12 edges, 6 quad faces, 24 corners, 12 derived triangles; outward normals; CCW winding; per-corner UVs; no zero-length edges or zero-area faces; no dangling refs; IDs survive serialize/deserialize; undo restores the command snapshot.
