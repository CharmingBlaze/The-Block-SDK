# Profile extrusion

**Package:** `@modeling-kit/primitives`  
**Implementation:** `packages/primitives/src/profile-extrude/`  
**Library:** `geometry-extrude` 0.2.1 (MIT)

The half-edge mesh remains the editable source of truth. Library typed arrays are a one-shot recipe. After `generateProfileExtrude` returns, those arrays are discarded.

## Ownership and conversion boundary

| Layer | Owns |
| --- | --- |
| Drawn profile / `ProfileDefinition` | 2D outer loop, optional holes, path vs polygon |
| `geometry-extrude` | Positions, normals, UVs, triangle indices in XY with +Z depth |
| `convertSimplicialComplex` | Remap XY→XZ (`(x,y,z) → (x,z,-y)`), weld, corner attributes, seams |
| `HalfEdgeMesh` | Canonical topology, branded IDs, serialization |
| `ExtrudeProfileCommand` | Document commit, exact undo/redo snapshots |
| `ProfileDrawTool` | Pointer collection on `ModalToolSession` only; no document mutation |
| `ThreeViewportAdapter` | Derived `BufferGeometry`; dispose on rebuild |

Callers import `generateProfileExtrude` from `@modeling-kit/primitives` (or `@modeling-kit/sdk`). They must not import `geometry-extrude` directly.

## Pipeline

Profile definition → `validateExtrudeParameters` → unusable-polygon reject (Earcut self-intersection) → library extrude → `convertSimplicialComplex` → `validateMesh` (inside convert) → command commit.

Failed validation throws `SchemaError` before any document write. Commands are transactional: a thrown generate leaves the previous document untouched.

## When to use which generator

| Intent | Call |
| --- | --- |
| Floor / slab | Polygon profile, `depth` as thickness |
| Wall along a path | `kind: "path"`, `lineWidth` as thickness, `depth` as height |
| Shape with holes | Polygon `holes` (paths cannot have holes) |
| Bevelled extrusion | `bevelSize` > 0, `bevelSegments` ≥ 1 |
| Open shell | `caps: false` (library `excludeBottom`) |

Existing `generateWall` remains the catalog box-wall primitive. Path extrusion is the freeform wall.

## Lifecycle and cleanup

Static conversion has no state machine.

Interactive drawing reuses `ModalToolSession` (`idle` → `beginning` → `active` → commit/cancel). `ProfileDrawTool` stores points and a `previewRevision` counter. Hosts must:

1. Call `generateProfileExtrude` / `ProfileExtrudePreview.update` from `previewParameters()`.
2. Rebuild viewport geometry when `previewRevision` changes.
3. Dispose the previous Three.js `BufferGeometry` on replace, cancel, and `dispose()`.

`ProfileExtrudePreview` replaces the previous kernel reference and increments `revision`. Cancelled strokes commit zero commands and drop the preview mesh so it can be collected.

## Failure and performance

- Non-finite coordinates, too few points, non-positive depth, path holes, self-intersecting outers, empty library output, or failed mesh validation throw. No partial mesh is returned.
- Cost is one library extrude plus one convert. No WASM, workers, or result cache.

geometry-extrude's `extrudePolyline` currently crashes (`rawVertices: vertices` is undefined in 0.2.1). Open paths are offset into a closed outline (`strokePathToPolygon`) and extruded with `extrudePolygon`. Bevels that emit non-finite normals or UVs drop those attributes; convert regenerates them from faces.

## Public API

Additive exports only:

- `generateProfileExtrude`, `generateFloor`, `generateWallPath`, `validateProfile`, `validateExtrudeParameters`, `ProfileExtrudePreview`
- `ExtrudeProfileCommand`
- `editor.spawn.profile` / `spawn.floor` / `spawn.wallPath`
- `ProfileDrawTool`

## Module map

- `types.ts` — profile and parameter types
- `validate.ts` — finite coords, counts, depth, bevel, path width
- `usable.ts` — self-intersection reject via `triangulatePolygonLoops`
- `path-outline.ts` — thick path → closed polygon
- `library.ts` / `import-api.ts` — typed wrapper; the only import of `geometry-extrude`
- `generate.ts` / `recipes.ts` — convert into `HalfEdgeMesh`
- `preview.ts` — replaceable preview holder
