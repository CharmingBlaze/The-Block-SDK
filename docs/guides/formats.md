# Formats and interchange

Canonical persistence is **native versioned JSON** on `ModelDocument`:

```ts
const json = session.saveNativeJson();
const reloaded = ModelingSession.loadNativeJson(json);
```

Open formats live in `@modeling-kit/formats`. They ingest or dump derived interchange meshes. They do not become a second mesh kernel. glTF uses **glTF Transform** (`@gltf-transform/core` + extensions). Three.js `GLTFLoader` / `GLTFExporter` are not the headless importer/exporter.

Implemented codecs: **glTF/GLB**, **Wavefront OBJ**, **ASCII STL**, **ASCII PLY**, **PPM** images. Binary PLY and binary STL are rejected by design; see each section.

Hosts can import the same table as data from `@modeling-kit/formats`:

```ts
import { FORMAT_CAPABILITY_MATRIX, formatCapability } from "@modeling-kit/formats";

formatCapability("obj").aspects.materials.fidelity; // "lose"
```

## Capability matrix

Fidelity is **preserve** (round-trips that aspect), **approximate** (kept in a reduced format-native form), **lose** (codec exists but drops it), or **none** (no codec, or the format cannot carry it). History and live selection are session-only and are not in any interchange file.

| Format | Topology | Materials | Skins | Animation | Notes |
| --- | --- | --- | --- | --- | --- |
| Native JSON | preserve | preserve | preserve | preserve | Canonical `ModelDocument` + half-edge kernel via `session.saveNativeJson()`. |
| glTF / GLB | approximate | approximate | approximate | approximate | Triangulated TRIANGLES; PBR subset; skins/clips optional; losses recorded. |
| Wavefront OBJ | approximate | lose | lose | lose | Polygon `v` / `vn` / `f` only. No `vt`, materials, skins, or animation. |
| ASCII STL | lose | lose | lose | lose | Triangle soup after tessellation. Binary STL is rejected. |
| PPM P3 | none | none | none | none | Image RGB only; import forces alpha to 255. |
| PLY (ASCII) | approximate | lose | lose | lose | Vertex rows + face index lists keep shared positions **and n-gons**. No UVs, colours, or normals. Binary PLY is rejected. |

`saveNativeJson()` writes the document. It does not mark the session saved unless you pass `{ markSaved: true }` after the host has actually persisted the bytes.

Architecture: [`../architecture/GLTF-PIPELINE.md`](../architecture/GLTF-PIPELINE.md).

## glTF / GLB

`importGltf`, `exportGltf`, and `exportGlb` are **async**. Public results are `ModelDocument`, `HalfEdgeMesh`, and diagnostics. glTF Transform types do not leak.

```ts
import { createSequenceIdFactory } from "@modeling-kit/core";
import { importGltf, exportGlb } from "@modeling-kit/formats";

const ids = createSequenceIdFactory("io");
const imported = await importGltf(glbBytes, ids, {
  mode: "repair", // or "strict"
  importSkins: true,
  importAnimations: true,
  importTextures: true,
});

for (const loss of imported.losses) {
  console.warn(loss.code, loss.message);
}

const { bytes } = await exportGlb(imported.document, imported.meshes, {
  exportSkins: true,
  exportAnimations: true,
  exportTextures: true,
});
```

| Option area | Import | Export |
| --- | --- | --- |
| Geometry | TRIANGLES only. Points, lines, strips, fans → `unsupported-primitive-mode`. Topology stays triangulated. | Derived triangles from the kernel. |
| Materials | PBR metallic-roughness factors + standard texture slots. Encoded image bytes kept; pixels are not decoded headlessly. | Optional `exportMaterials` / `exportTextures`. |
| Skins / clips | `importSkins` / `importAnimations` (default on). Canonical skeleton/clip data. | `exportSkins` / `exportAnimations`. |
| Resources | No `fetch` or `fs` in the memory IO. External URIs need an `ExternalResourceResolver`. | `resourceMode: "embedded" \| "external"`. |
| Cancel | `AbortSignal` | `AbortSignal` |

Registered extensions include `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_lights_punctual`, `KHR_node_visibility`, `EXT_texture_webp`. Unsupported extensions become `unsupported-extension` losses.

Stable data-loss codes include `unsupported-primitive-mode`, `unsupported-extension`, `unsupported-material-property`, `unsupported-animation-channel`, `unsupported-interpolation`, `skin-influence-truncated`, `texture-format-unsupported`, `matrix-shear-lost`, `metadata-dropped`.

## OBJ and STL

```ts
import { exportObj, importObj, exportStlAscii, importStlAscii } from "@modeling-kit/formats";

const objText = exportObj(mesh);
const stlText = exportStlAscii(mesh);
```

OBJ round-trips polygon vertex loops (`v` / `vn` / `f`). It does **not** write or read `vt` UVs or materials. STL ASCII writes facet normals after triangulation. Use `*WithReport` variants when you need conversion diagnostics. Binary STL is not in this package.

## PLY

```ts
import { createSequenceIdFactory } from "@modeling-kit/core";
import { exportPly, importPlyWithReport } from "@modeling-kit/formats";

const plyText = exportPly(mesh, { comment: "level-01" });

const ids = createSequenceIdFactory("io");
const { mesh: back, report } = importPlyWithReport(plyText, ids);
for (const warning of report.warnings) console.warn(warning);
```

PLY is the **best open interchange for quad and n-gon workflows**: a face is
written as a length-prefixed index list, so `MeshBuilder.createCube` exports as
six quads (`4 0 1 2 3`) rather than the twelve triangles STL produces. Vertices
are written once and referenced, so shared topology survives the round trip.

Header rules the reader enforces:

- `format ascii 1.0` is required; `binary_little_endian` / `binary_big_endian`
  throw rather than guess a byte order and word size.
- The `vertex` element must declare scalar `x`, `y`, `z`. Any other per-vertex
  property (`nx`, `red`, …) is consumed and reported as dropped, so extra columns
  cannot shift the face rows out of alignment.
- The `face` element needs exactly one list property.
- Rows are collected before the mesh is built, so a file that declares
  `element face` before `element vertex` still resolves indices correctly.
- Unsupported elements (`edge`, `property`, camera blocks) are consumed row by
  row and reported, which keeps later elements aligned.
- A non-finite vertex coordinate **throws** instead of being skipped: dropping a
  vertex would silently renumber every later face reference.
- Out-of-range or fewer-than-3-distinct-vertex faces are skipped and counted in
  one warning.

Only the first `vertex` and first `face` element are used.

## Images

`exportImagePpm` / `importImagePpm` for tiled paint buffers. Texture RGBA in native JSON uses `pixelsBase64` via session flush/hydrate.

## What not to do

| Need | Call | Do not |
| --- | --- | --- |
| Save the project | `session.saveNativeJson()` | Treat exported glTF as the document |
| Canonical cube / UV sphere | `editor.spawn.cube()` / `spawn.sphere()` | Treat a library recipe as the same mesh |
| Library recipe | `convertSimplicialComplex` / `generateLibraryPrimitive` | Infer triangles vs quads from buffer length |
| glTF / OBJ / STL / PLY | `@modeling-kit/formats` | Run files through `facesFromFlatCells` |
| Render IDs | `triangulateMesh` maps | Persist GPU indices as topology |

`PRIMITIVE_CATALOG` tells a host whether a public name is canonical or a library recipe. See [primitive-geometry](primitive-geometry.md) and [`apps/geometry-gallery`](examples.md).
