# Primitive topology

modeling-kit is **quad-first**, not all-quads. Editable topology is intentional. Face size is never inferred from an index-buffer length.

## Pipeline

```text
Ingest (three families, never mixed)
    ↓
MeshBuilder  (the only constructor)
    ↓
Half-edge editable mesh  (native JSON source of truth)
    ↓
triangulateMesh  (derived triangles + FaceId / VertexId / CornerId maps)
    ↓
Three.js / meshopt / glTF-OBJ-STL export  (derived dumps)
```

There is **one** mesh constructor: `MeshBuilder`. Do not add a second kernel. Do not send file formats through the library cell converter, and do not send library typed arrays through the glTF/OBJ parsers.

## Three ingest families

| Family | Enters through | Topology comes from | Must not |
| --- | --- | --- | --- |
| Canonical generators | `generateBox`, `generateUvSphere`, `spawn.cube`, … | Construction keys (`PRIMITIVE_CATALOG`) | Emit triangle soup and reconstruct quads |
| Recipe libraries | `convertSimplicialComplex` (`cellSize` required). `primitive-geometry` and `geometry-extrude` only. | Caller-declared `cellSize` 3 or 4, never `cells.length` | Import `primitive-geometry` / `geometry-extrude` from hosts; guess 3 vs 4 |
| Interchange formats | `@modeling-kit/formats` `importGltf` / `importObj` / `importStlAscii` | The file: OBJ face loops, glTF `TRIANGLES` primitives, STL triangles | Route through `GeometrySourceData` / `facesFromFlatCells`; treat glTF as the editor document |

Native JSON is not an ingest converter. It already *is* the half-edge document.

`facesFromFlatCells` is the library-family expander inside `@modeling-kit/primitives`. It is not a host SDK export and not a format importer. Formats already know their polygons; stuffing an OBJ n-gon list into a packed `cellSize` buffer would throw away that metadata.

Outward dumps are the reverse of ingest:

| Dump | Package | Mutates HalfEdgeMesh? |
| --- | --- | --- |
| Viewport `BufferGeometry` | `@modeling-kit/three-adapter` | no |
| Vertex-cache / LOD triangles | `@modeling-kit/meshopt` | no |
| glTF / OBJ / STL | `@modeling-kit/formats` | no (export triangulates n-gons and reports loss) |
| Earcut / ear-clip | `@modeling-kit/mesh` `triangulatePolygon` | only if `triangulateFaces` is the command |

## Layer 1 — sources

| Source | Topology metadata |
| --- | --- |
| Canonical SDK generators | Intentional quads / mixed / triangles from `PRIMITIVE_CATALOG` |
| `primitive-geometry` | Packed `cells` + **required** `cellSize` |
| `geometry-extrude` | Triangle soup + `cellSize: 3`, then `convertSimplicialComplex` |
| OBJ / glTF / STL | Format-native faces or triangles, in `@modeling-kit/formats` |
| PLY | Allowed open standard; no codec in this package yet |
| Documents / scripts | Already half-edge |

## Layer 2 — explicit face recipe (library family only)

`packages/primitives/src/source/` is the *library* expander. Formats never construct `GeometrySourceData`. Hosts never import it: they call `convertSimplicialComplex` and read `ConvertedPrimitive` mappings.

- `SourceFace.indices` is the polygon loop.
- Packed buffers become faces only through `facesFromFlatCells(cells, cellSize)` or `facesFromOffsets`.
- `cellSize` is required for flat cells. `cells.length % 12 === 0` is **not** a topology signal.

A 36-index buffer might be 12 triangles, 9 quads, or mixed polygons. Without explicit boundaries it cannot be recovered.

## Layer 3 — canonical construction

Shared work (not duplicated per generator):

- Finite positions and index range — `MeshBuilder` / library convert
- Repeated-index rejection — `facesFromFlatCells` + `buildCell`
- Welding — `WeldPolicy`: `none` (source-index identity), `connected-coincident`, `solid`, `uv-grid`
- Winding — preserve, outward-from-origin, or a reported reversal when a directed edge is occupied
- Corner UVs and normals — `addFace` options
- Seams — `markUvSeams`
- Manifold — `validateMesh` in `finalizePrimitive`

Canonical generators keep **construction keys** (cube IJK, ring index). They do not emit triangle soup and reconstruct quads.

Library default weld is `none` unless the recipe or type policy sets otherwise. Solid cube import still welds coincident corners because the cube recipe asks for `solid`.

Library conversion defaults to `skipDegenerateFaces: true`. Source faces with repeated indices, post-weld pole collapse, and zero-area cells are reported in `warnings` and omitted. A buffer whose every face is degenerate still throws. Canonical generators never emit those cells.

`skipDegenerateFaces: false` turns the first skipped face into an error — used by tests that require strict rejection.

## Layer 4 — render

`triangulateMesh` triangulates canonical faces. Render vertices are per-corner (position + UV + normal). Mappings:

- `triangleFaceIds` → canonical `FaceId`
- `vertexIdMap` → canonical `VertexId`
- `cornerIdMap` → canonical `CornerId`

The Three.js adapter copies those into `RenderMapping` (`triangleToFace`, `renderVertexToVertex`, `renderVertexToCorner`). Those IDs are branded kernel IDs, never GPU buffer indices. Flat shading is a material flag.

## Catalog

`PRIMITIVE_CATALOG` records topology, purpose, and generator kind. `generatePrimitive` still selects implementations; the registry exists so commands/UI do not guess from index counts.

| Public name | Generator | Editable topology |
| --- | --- | --- |
| `cube` / `box` | canonical | 6 quads; subdivided = quad grids |
| `plane` / `grid` / `quad` | canonical | quads |
| `quadSphere` | canonical | cube-projected quads, IJK weld, 3×2 atlas |
| `torus` | canonical | wrapped quad grid |
| `cylinder` | canonical | quad walls, n-gon caps |
| `sphere` / `uvSphere` / `spawn.sphere` | canonical UV sphere | quad bands, triangle poles |
| `capsule` | canonical | quad bands, triangle poles |
| `cone` | canonical | apex triangles, lower quad bands, n-gon cap |
| `roundedCube` | canonical | cube-grid projected rounded box, quads |
| `icosphere` | canonical | triangles |
| `tetrahedron` / `icosahedron` / Reuleaux / … | library reference | imported triangles |

Do not silently change `spawn.sphere` to `quadSphere`.

## UV and normals

UVs and normals live on **corners**. A UV discontinuity is a seam; the editable vertex stays shared. Render conversion may split. Serialization stores corner attributes.

Quad-sphere UVs use a 3×2 cube atlas in `[0,1]²`. Atlas corners may share numeric UV values; tests check islands and seams, not “24 unique UV pairs”.

## Prohibited

Inferring face size from index count; pairing triangles into quads on import; repeating poles to fake quads; global position welding for every source; treating render indices as editable IDs; claiming every primitive is all-quads.

Verification matrix: `docs/verification/PRIMITIVE-TOPOLOGY-MATRIX.md`.
