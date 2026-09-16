# Approved dependency policy

Use a small, deliberate stack. There is no complete TypeScript library that already provides professional editable topology, primitives, UVs, selections, bevels, loop cuts, undo, rigging, and Three.js rendering correctly. **This SDK’s canonical work stays in our packages.** Third-party code is only for derived work (triangulation, predicates, viewport acceleration, interchange processing).

This document is adapted to modeling-kit as it exists today. Do not restart the kernel, math, commands, or the hand-written glTF/GLB codecs to chase a “perfect” stack.

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
| `earcut` | N-gon → derived triangles (render, pick, glTF, area) | `@modeling-kit/mesh` behind `TriangulationBackend` | When fan triangulation is insufficient (concave n-gons / knife) |
| `robust-predicates` | `orient2d` / `orient3d` | `@modeling-kit/math` behind `GeometryPredicates` | **Added 2026-09-16.** Sign/orientation only; distances stay on `GeometryTolerance`. See `docs/guides/geometry-predicates.md`. |
| `zod` | Native JSON, tool params, clipboard, worker messages | `@modeling-kit/document` (and formats IO) | After a schema is frozen; do not Zod every vector op |
| `fast-check` | Property tests (undo fingerprints, validity) | devDependency | After one generator is stable |
| `primitive-geometry` | Typed-array geometry recipes (positions/normals/UVs/cells) | `@modeling-kit/primitives` behind `convertSimplicialComplex` | 2026-09-16. Canonical primitives use `MeshBuilder`. Library `cells` are triangles unless `cellSize` is explicit. See `docs/architecture/primitive-topology.md`. |

## Approved later, optional adapter packages only

| Package | Adapter | Gate |
| ------- | ------- | ---- |
| `three-mesh-bvh` | optional peer of `three-adapter` as `SpatialQueryBackend` | Picking/lasso on large meshes; dirty levels, not rebuild every pointer move |
| `manifold-3d` | `@modeling-kit/booleans-manifold` as `BooleanBackend` | After kernel, selection, extrusion, undo, save/load (already passing) **and** a conversion-report design |
| `@gltf-transform/*` | optional processor **beside** our codecs as `GltfBackend` helpers | Dedup/prune/texture resize. **Do not replace** `exportGltf` / `importGltf` / `exportGlb` |
| `meshoptimizer` | `@modeling-kit/meshopt` on **derived** triangles only | After glTF export (already working) |
| `comlink` | workers | If postMessage friction is measured |

Keep Manifold, glTF Transform, meshoptimizer, and Comlink **out of** `@modeling-kit/mesh`, `@modeling-kit/document`, and `@modeling-kit/sdk` required dependencies.

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
- `GltfBackend` — our formats package is the first implementation; Transform is optional processing  
- `MeshOptimizationBackend` — meshoptimizer on export triangles only  

## First primitive bar (box)

Exactly 8 vertices, 12 edges, 6 quad faces, 24 corners, 12 derived triangles; outward normals; CCW winding; per-corner UVs; no zero-length edges or zero-area faces; no dangling refs; IDs survive serialize/deserialize; undo restores the command snapshot.
