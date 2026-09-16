# Primitive topology verification matrix

Current behavior after the explicit-face-recipe hardening. Commands: `pnpm exec vitest run packages/primitives/tests packages/three-adapter/tests/adapter.test.ts` then the release gate.

| Public name | Source | Topology | Closed | UV | Normals | Seams | Render | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cube / box | canonical `generateBox` | 6 quads; subdivided quads | yes | per-face 0–1 corners | fallback / face | optional | 12 tris from 6 faces | topology-canonical, primitives |
| plane / grid / quad | canonical | quads | no | corners | +Y | none | 2 tris / quad | primitives |
| quadSphere | canonical cube grid → radius | quads only, IJK keys | yes | 3×2 atlas | radial smooth | cube-face UV seams, shared verts | 2 tris / quad, FaceId map | topology-canonical |
| torus | canonical | quads, wrap | yes | 0–1 with wrap u | smooth-ish fallback | wrap edges marked | 2 tris / quad | topology-canonical |
| cylinder | canonical | quad walls, n-gon caps | yes if capped | polar caps, unwrap walls | fallback | U wrap | n-gons earcut/earclip | topology-canonical |
| uvSphere / spawn.sphere | canonical | mixed: quad bands + pole tris | yes | spherical + unwrap | fallback | U wrap | mixed | topology-canonical |
| capsule | canonical | mixed: quad bands + pole tris | yes | cylindrical unwrap | fallback | U wrap | mixed | topology-canonical |
| cone | canonical | apex tris, optional quad bands, n-gon cap | yes if capped | polar + unwrap | fallback | U wrap | mixed | topology-canonical |
| roundedCube | canonical cube grid → rounded box | quads | yes | per-face 0–1 | rounded-box smooth | cube edges | 2 tris / quad | topology-canonical |
| icosphere | canonical | triangles | yes | spherical | fallback | none special | 1:1 tris | topology-canonical |
| library cube / sphere / … | `generateLibraryPrimitive` | triangles unless explicit `cellSize: 4` | solids closed | supplied corners | supplied corners | UV delta | 1:1 with tris | library.test |
| reuleux, ellipsoid, tet, icosa, … | catalog library | triangles | as library | supplied | supplied | as converted | tris | library.test |

## Converter contract

- Flat `cells` **require** `cellSize`.
- `cells.length % 12 === 0` still becomes triangles when `cellSize: 3`.
- Repeated indices on a buffer that is *only* degenerate throw. Mixed library recipes (annulus, poles) skip those cells with `degenerate-skipped` warnings.
- Out-of-range indices throw.
- Zero-area faces throw when `skipDegenerateFaces: false`.
- Weld `none` keeps source-index vertices even if positions coincide.
- Unusable (non-finite) library normals/UVs are omitted; convert regenerates fallback attributes.
- Type cube import uses `solid` weld → 8 vertices, 12 triangles, corner UVs (not 24 unique numeric pairs).

## Remaining limitations

- Formats stay on their own importers. That is intentional: OBJ n-gons and glTF triangle primitives are not packed `cellSize` buffers, so they must not go through `facesFromFlatCells`.
- Automatic triangle-to-quad reconstruction is **not** part of import. If added, it must be `reconstructQuads(mesh, options)`.
- Library conversion defaults to skipping degenerate source cells with warnings (annulus/poles). Canonical generators do not rely on that path.
- Open path extrusion strokes a polygon outline instead of calling `geometry-extrude.extrudePolyline` (broken in 0.2.1).
- Earcut corpus self-intersection / non-finite cases in `@modeling-kit/mesh` are separate from this primitive work.

## Hardening status (2026-09-16)

| Item | Result |
| --- | --- |
| Files changed | Explicit face IR (`packages/primitives/src/source/`), library convert (no index-count guessing), catalog registry, quad-sphere/UV-sphere/capsule winding, Three.js `RenderMapping.renderVertexToCorner`, path stroke for profile walls |
| Tests added | `topology-canonical.test.ts` (cube/quadSphere/mixed/icosphere/converter contract), library converter regressions, adapter picking |
| Behavior corrected | Face size never inferred from index count; library cells stay triangles; UV sphere/capsule poles are real triangles with outward winding; degenerate library cells warn instead of inventing topology |
| Public compatibility | `convertSimplicialComplex` + `ConvertedPrimitive` mappings on `@modeling-kit/sdk`. `facesFromFlatCells` / `GeometrySourceData` stay inside primitives. Formats keep native importers. `spawn.sphere` remains UV sphere. Additive: `PRIMITIVE_CATALOG`, `renderVertexToCorner` |
| Remaining limitations | Formats keep native importers (not library cell IR); no silent `reconstructQuads`; library skip-degenerate default |
| Verification | See commands below |

```text
pnpm typecheck           # packages passed
pnpm examples:typecheck  # apps passed
pnpm lint                # eslint . exit 0
pnpm test                # 66 files, 507 tests
pnpm build               # packages/* tsup passed
pnpm arch:check          # 455 modules, no violations
pnpm pack:verify         # 24 packages, 12 fixture imports
```


- `convertSimplicialComplex` now requires `cellSize` on the options object. Library recipes already passed it. Callers that omitted it must pass `cellSize: 3`.
- `ConvertedPrimitive` adds `sourceFaceToCanonicalFaceIds` and `warnings`.
- `RenderMapping.renderVertexToCorner` is additive.
- `spawn.sphere` remains UV sphere.
