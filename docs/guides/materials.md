# Materials and texture sets

Canonical PBR/unlit data lives on `ModelDocument.materials`. GPU materials are adapter caches only.

`CreateMaterialCommand` / `UpdateMaterialCommand` own library materials. `CreateMaterialInstanceCommand` / `UpdateMaterialInstanceCommand` own per-object overrides (`materialInstances`). `CreateTextureSetCommand` groups named channels (`baseColor`, `normal`, `metallicRoughness`, `emissive`, `occlusion`); `BindMaterialTextureSetCommand` copies those ids onto `textureBindings` and the legacy `*Texture` fields so both aliases stay in sync. `DeleteTextureSetCommand` drops the set and clears `textureSetId` on bound materials (undo restores both).

`emissive` / `emissiveColor` and `baseColor` / `color` stay equal after `createMaterialData` and `UpdateMaterialCommand` (`syncMaterialDualFields`). `textureBindings` and the legacy `*Texture` ids stay aligned the same way. Prefer `UpdateMaterialCommand` patches over writing the store.
