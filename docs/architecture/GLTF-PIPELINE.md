# glTF pipeline

Canonical interchange is `@modeling-kit/formats` using **glTF Transform** (`@gltf-transform/core` + `@gltf-transform/extensions` only). Three.js `GLTFLoader` / `GLTFExporter` are not the headless SDK importer/exporter. Host guide: [`../guides/formats.md`](../guides/formats.md).

## Boundary

- Public APIs return `ModelDocument`, `HalfEdgeMesh`, and structured diagnostics.
- glTF Transform `Document`, `Node`, `Mesh`, and `Accessor` types do not leak through `importGltf` / `exportGltf` results.
- `MemoryPlatformIO` never calls `fetch` or Node `fs`. External URIs require an `ExternalResourceResolver`.
- Optional codecs (Draco, meshopt compression, KTX2/Basis, `@gltf-transform/functions`, `sharp`) are **not** dependencies of the base package.

Registered extensions on the I/O layer: `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_lights_punctual`, `KHR_node_visibility`, `EXT_texture_webp`. Unsupported extensions are recorded as `unsupported-extension` losses; names may be stored in document metadata when `preserveUnknownExtensions` is true.

## Import / export

`importGltf` / `exportGltf` / `exportGlb` are **async**. Options include `mode: "strict" | "repair"`, feature flags (`importSkins`, `exportAnimations`, …), resource limits, and an optional `AbortSignal`.

Geometry: TRIANGLES only. Points, lines, strips, and fans are skipped with `unsupported-primitive-mode`. Canonical topology stays triangulated after import; quad reconstruction is a separate modeling operation.

Materials: metallic-roughness PBR factors and the five standard texture slots, plus samplers. Encoded image bytes are preserved; headless import does not decode pixels.

Skins and animations: see [RIGGING.md](./RIGGING.md), [SKINNING.md](./SKINNING.md), [ANIMATION.md](./ANIMATION.md).

## Data-loss codes

Stable codes include `unsupported-primitive-mode`, `unsupported-extension`, `unsupported-material-property`, `unsupported-animation-channel`, `unsupported-interpolation`, `skin-influence-truncated`, `texture-format-unsupported`, `matrix-shear-lost`, `metadata-dropped`, plus `ibm-identity-default`, `markers-omitted`, `visibility-track-omitted`.

Each diagnostic has code, severity, message, and optional source path / affected object / suggested correction.

## Module layout

Import, export, resources, conversion, diagnostics, and validation live under `packages/formats/src/gltf/` as focused files. Do not collapse this into a single `gltf.ts`.
