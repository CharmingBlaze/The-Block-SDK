# @modeling-kit/materials

**PBR and unlit material system for The Block SDK.** Canonical material data models, texture bindings (5 channels), multi-material slots, validation, document-backed library — glTF 2.0 compatible.

## Purpose

- **Standard PBR** (`StandardPBRMaterial`) — metallic-roughness: baseColor, metallic, roughness, emissive, normalScale, occlusionStrength, alphaMode/cutoff, doubleSided
- **Unlit** (`UnlitMaterial`) — flat color with optional texture and vertex colors
- **Material slots** — stable `MaterialSlotId` per face; survive reordering
- **Texture bindings** — 5 typed channels (`baseColor`, `normal`, `metallicRoughness`, `occlusion`, `emissive`) with colorSpace and UV transform
- **Material instances** — per-object overrides without duplicating definitions
- **Material library** — document-backed cache with revision tracking
- **Validation** — comprehensive checks for all material types
- **Conversion** — bidirectional `MaterialData` ↔ `MaterialDefinition`

## PBR Texture Channels

| Channel             | Three.js Map                  | Color Space |
|---------------------|-------------------------------|-------------|
| `baseColor`         | `map`                         | sRGB        |
| `normal`            | `normalMap`                   | Linear      |
| `metallicRoughness` | `metalnessMap`+`roughnessMap` | Linear      |
| `occlusion`         | `aoMap`                       | Linear      |
| `emissive`          | `emissiveMap`                 | sRGB        |

## Key Exports

```ts
import {
  createStandardPbrMaterial, createUnlitMaterial, createPbrMaterial,
  createMaterialSlot, createMaterialData, createTextureData,
  assignFaceMaterialSlot, addSlotToRecord, reorderSlotsInRecord,
  MaterialLibrary, validateStandardPbrMaterial, assertValidMaterial,
  materialDataToDefinition, materialDefinitionToData,
  type StandardPBRMaterial, type UnlitMaterial, type MaterialSlot,
  type TextureBinding, type MaterialAlphaMode,
} from "@modeling-kit/materials";
```

## Usage Examples

```ts
// Basic PBR
const metal = createStandardPbrMaterial({
  id: "mat-steel", name: "Brushed Steel",
  baseColor: [0.6, 0.6, 0.7, 1.0], metallic: 0.9, roughness: 0.3,
});

// Full PBR with texture maps
const textured = createStandardPbrMaterial({
  id: "mat-brick", name: "Brick",
  baseColor: [1, 1, 1, 1], roughness: 0.8,
  normalScale: 1.0, occlusionStrength: 1.0,
  textureBindings: {
    baseColor: { textureId: "tex-albedo", colorSpace: "srgb" },
    normal: { textureId: "tex-normal", colorSpace: "linear" },
    metallicRoughness: { textureId: "tex-mr", colorSpace: "linear" },
    occlusion: { textureId: "tex-ao", colorSpace: "linear" },
  },
});

// Alpha blend / mask
const glass = createStandardPbrMaterial({
  id: "mat-glass", name: "Glass",
  baseColor: [0.9, 0.95, 1.0, 0.3], roughness: 0.1, alphaMode: "blend",
});
const leaves = createStandardPbrMaterial({
  id: "mat-leaves", name: "Leaves",
  baseColor: [0.2, 0.8, 0.3, 1.0], roughness: 0.9,
  alphaMode: "mask", alphaCutoff: 0.5, doubleSided: true,
});

// Material Library with instances
const lib = MaterialLibrary.fromDocument(document);
lib.addMaterial(metal);
const inst = lib.createInstance("inst-blue", "mat-steel", "Blue", {
  baseColor: [0, 0, 1, 1],
});
const resolved = lib.resolveInstance("inst-blue"); // [0, 0, 1, 1]
```

## Architecture Notes

- Material data lives in the document `EntityStore`; this package provides manipulation utilities.
- `MaterialSlot` uses stable IDs — face assignments survive reordering.
- PBR uses glTF 2.0 metallic-roughness for lossless round-trip export.
- `TextureBinding.colorSpace`: `"srgb"` for color, `"linear"` for data maps (normal, MR, occlusion).
- `MaterialLibrary` caches resolved instances; invalidates on parent changes via revision tracking.
- The Three.js adapter resolves ALL 5 PBR texture channels from `MaterialData` automatically.
- See `docs/guides/materials.md` for the full workflow guide.