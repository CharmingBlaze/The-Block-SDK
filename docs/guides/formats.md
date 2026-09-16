# Formats and interchange

Canonical persistence is **native versioned JSON** on `ModelDocument`:

```ts
const json = session.saveNativeJson();
const reloaded = ModelingSession.loadNativeJson(json);
```

Open formats live in `@modeling-kit/formats`. They ingest or dump derived interchange meshes. They do not become a second mesh kernel. glTF uses **glTF Transform** (`@gltf-transform/core` + extensions). Three.js `GLTFLoader` / `GLTFExporter` are not the headless importer/exporter.

Implemented codecs: **glTF/GLB**, **Wavefront OBJ**, **ASCII STL**, **PPM** images. PLY is an allowed open standard in the clean-room policy; there is no codec yet.

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
| PLY | none | none | none | none | Allowed standard; no codec yet. |

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

## Images

`exportImagePpm` / `importImagePpm` for tiled paint buffers. Texture RGBA in native JSON uses `pixelsBase64` via session flush/hydrate.

## What not to do

| Need | Call | Do not |
| --- | --- | --- |
| Save the project | `session.saveNativeJson()` | Treat exported glTF as the document |
| Canonical cube / UV sphere | `editor.spawn.cube()` / `spawn.sphere()` | Treat a library recipe as the same mesh |
| Library recipe | `convertSimplicialComplex` / `generateLibraryPrimitive` | Infer triangles vs quads from buffer length |
| glTF / OBJ / STL | `@modeling-kit/formats` | Run files through `facesFromFlatCells` |
| Render IDs | `triangulateMesh` maps | Persist GPU indices as topology |

`PRIMITIVE_CATALOG` tells a host whether a public name is canonical or a library recipe. See [primitive-geometry](primitive-geometry.md) and [`apps/geometry-gallery`](examples.md).
