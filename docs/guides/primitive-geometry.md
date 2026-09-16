# Primitive-geometry conversion

**Package:** `@modeling-kit/primitives`  
**Implementation:** `packages/primitives/src/library/`  
**Library:** `primitive-geometry` 2.11.0 (MIT)

The half-edge mesh remains the editable source of truth. Library typed arrays are a one-shot recipe. After `convertSimplicialComplex` returns, those arrays are discarded.

## Ownership and conversion boundary

| Layer | Owns |
| --- | --- |
| `primitive-geometry` | Positions, normals, UVs, cell indices for a recipe |
| `convertSimplicialComplex` | Validation, weld policy, orientation, corner attributes, seams |
| `HalfEdgeMesh` | Canonical topology, branded IDs, serialization |
| `triangulateMesh` | Derived triangles + `triangleFaceIds` for picking |
| `ThreeViewportAdapter` | Derived `BufferGeometry`; dispose on rebuild |

Callers import `generateLibraryPrimitive` / `convertSimplicialComplex` from `@modeling-kit/primitives` (or `@modeling-kit/sdk`). They must not import `primitive-geometry` directly.

`convertSimplicialComplex` is **not** the glTF/OBJ/STL path. Those files already declare faces or triangle primitives in `@modeling-kit/formats`. Packed `cells` + `cellSize` is only for recipe libraries (`primitive-geometry`, and `geometry-extrude` after XY→XZ remap). Hosts that need a file on disk use `importGltf` / `importObj` / `importStlAscii`, then native JSON for persistence.

There is no lifecycle machine. Conversion is a pure function: invalid input throws `SchemaError` before a mesh is committed. `generateLibraryPrimitive` validates parameters first.

## What is converted

Supported library ids are `LIBRARY_GEOMETRY_IDS`: planar recipes (quad, rectangle, rounded rectangle, stadium, ellipse, disc, annulus, superellipse, squircle, Reuleaux) and solids (library cube, rounded cube, sphere, icosphere, ellipsoid, cylinder, cone, capsule, torus, tetrahedron, icosahedron).

Excluded catalog entries:

- Library `circle` (polyline, no faces)
- Library `box` / modeling `cube` as the canonical 6-quad bar (`generateBox` stays the modeling primitive)

Planar recipes are generated in XY and remapped onto the SDK XZ ground plane (`remapXyToXz`). Library `cells` are triangles unless the caller passes explicit `cellSize`. A buffer whose length is divisible by 12 is still parsed as triangles.

## Attributes, seams, and welding

- UVs and normals become **per-corner** attributes. Shared positions with different UVs (unwrap seams) or different normals (hard edges) stay separate corners on a welded vertex.
- Welding is policy-driven (`WeldPolicy`): connected-coincident, solid manifold, or UV-grid wrap. Coincident *render* vertices are not merged when that would collapse a seam.
- Missing UVs/normals are filled; supplied UVs are not overwritten.
- Wrap seams (cylinder, sphere, torus) are marked on edges (`isSeam`).
- Face groups (`top` / `bottom` / `caps` / `sides`) are derived after orientation so tagged select still works.

## Failure and performance

- Non-finite positions, bad index ranges, mismatched attribute lengths, zero remaining faces, or failed `validateMesh` throw. No partial mesh is returned.
- Repeated indices and zero-area cells in mixed library recipes are skipped with warnings; a fully degenerate buffer still throws.
- Unusable (non-finite) normals/UVs are omitted and regenerated.
- Cost is one typed-array generation plus a single convert. No per-frame library cost, no WASM, no result cache.

## Display, undo, and picking

Use the existing Three.js adapter. `triangulateMesh` keeps `triangleFaceIds`, `vertexIdMap`, and `cornerIdMap`. The adapter copies those into `RenderMapping` (including `renderVertexToCorner`). Serialization and `CreatePrimitiveCommand` / `CreateLibraryPrimitiveCommand` undo restore the stored kernel snapshot.

Regenerated viewport geometry is disposed by `ThreeViewportAdapter` when the object is removed or the adapter is disposed.

## Public API

Additive exports: `convertSimplicialComplex` (requires explicit `cellSize`), `ConvertedPrimitive` (`sourceFaceToCanonicalFaceIds`, `sourceIndexToVertex`, `warnings`), `generateLibraryPrimitive`, `validateLibraryParameters`, `resolveCellSize`, `PRIMITIVE_CATALOG`, `getPrimitiveCatalogEntry`, `LIBRARY_GEOMETRY_IDS`, `LIBRARY_DISPLAY_NAMES`, `isLibraryGeometryId`, `CreateLibraryPrimitiveCommand`, `editor.spawn.library(kind, params)`. Face-buffer expansion (`facesFromFlatCells`, `GeometrySourceData`) stays inside `@modeling-kit/primitives` and is not a host-facing SDK export.

Modeling generators (`generateBox`, `generateQuadSphere`, `generateCylinder`, `spawn.cube`, `spawn.sphere` → `uvSphere`, `spawn.quadSphere`) are the canonical path.

## Module map

Conversion is split so weld, cells, orientation, and recipes can be debugged independently:

- `library/convert.ts` — orchestration
- `library/weld.ts` / `weld-policy.ts` / `weld-grid.ts` — vertex sharing
- `library/cells.ts` / `faces.ts` / `orient.ts` / `seams.ts` — topology
- `library/recipes-planar.ts` / `recipes-solid.ts` — library calls
- `catalog-library.ts` — catalog types that delegate to the library
- `rounded-cube.ts` / `rounded-cube-project.ts` — canonical all-quad rounded cube

Static conversion has no state machine. Preview overlays in `apps/geometry-gallery/src/` are disposed on `pagehide`.

Checker-texture, wireframe, and flat/smooth shading for every supported primitive:

```bash
pnpm --filter @modeling-kit/geometry-gallery dev
```

See also: [Fluent editor](fluent-editor.md), [Formats](formats.md), [Examples](examples.md).
