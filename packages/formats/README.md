# @modeling-kit/formats

**File format import/export.** Converts between the SDK's canonical document model and standard 3D file formats: glTF 2.0, OBJ, STL, and PLY.

## Purpose

The `formats` package provides lossless or near-lossless round-trip conversion:

- **glTF 2.0** — `.gltf` and `.glb` export/import with full PBR material preservation, skeletal animation, and texture embedding
- **OBJ** — `.obj` import/export with material groups, normals, and UVs
- **STL** — ASCII STL import/export for 3D printing workflows
- **PLY** — `.ply` (Stanford Polygon Format) import/export with vertex colors and face attributes
- **Resource resolution** — `ExternalResourceResolver` abstracts buffer/texture loading for glTF import
- **Diagnostics** — structured warnings for data loss during export (e.g., `GltfDiagnostic`, `GltfDataLossCode`)

## Key Exports

```ts
// glTF
import {
  exportGltf, exportGlb,
  exportGltfWithReport, exportGlbWithReport,
  importGltf,
  type GltfExportOptions, type GltfExportResult, type GlbExportResult,
  type GltfImportOptions, type GltfImportResult,
  type GltfImportSource, type GltfWeldMode,
} from "@modeling-kit/formats";

// OBJ
import {
  exportObj, importObj,
  exportObjWithReport, importObjWithReport,
  type ObjExportOptions, type ObjImportOptions, type ObjIoResult,
} from "@modeling-kit/formats";

// STL
import {
  exportStlAscii, importStlAscii,
  importStlAsciiWithReport, stlExportReport,
  type StlExportOptions, type StlImportOptions, type StlImportResult,
} from "@modeling-kit/formats";

// PLY
import {
  exportPly, importPly,
  exportPlyWithReport, importPlyWithReport,
  plyExportReport,
  type PlyExportOptions, type PlyImportOptions, type PlyImportResult,
} from "@modeling-kit/formats";

// Resource resolution
import {
  MemoryResourceResolver,
  DEFAULT_GLTF_RESOURCE_LIMITS,
  type ExternalResourceResolver, type GltfResourceLimits,
} from "@modeling-kit/formats";
```

## Usage Example

```ts
import { exportGlb, importGltf } from "@modeling-kit/formats";
import type { EditorSession } from "@modeling-kit/document";

// Export to GLB
const glbBytes = exportGlb(session, {
  binary: true,
  embedTextures: true,
  preserveNames: true,
});

// Import from glTF
const result = await importGltf({
  source: { type: "url", url: "model.gltf" },
  weldMode: "position-and-normal",
});
// result.session contains a ready-to-use EditorSession
```

```ts
import { exportObj, importObj } from "@modeling-kit/formats";

// Export to OBJ
const objText = exportObj(session, {
  flipYZ: false,
  exportMaterials: true,
});

// Import OBJ
const objResult = importObj(objText, {
  flipYZ: false,
  weldVertices: true,
});
```

## Architecture Notes

- Importers create a **complete `EditorSession`** — the result is immediately editable with full undo/redo support.
- Exporters accept an `EditorSession` and produce serialized format data — all exports are lossless for supported features.
- glTF import creates PBR materials, skeleton data, and animation clips automatically.
- `MemoryResourceResolver` resolves external file references (textures, buffers) from in-memory maps — useful for drag-and-drop or embedded buffers.
- `DEFAULT_GLTF_RESOURCE_LIMITS` protects against malicious files (max file size, max triangle count, etc.).
- Export reports (`exportGltfWithReport`) provide structured warnings about data that couldn't be preserved in the target format.
- See `docs/guides/formats.md` for detailed format coverage matrices.