# Materials and texture sets

Canonical PBR/unlit data lives on `ModelDocument.materials`. GPU materials are adapter caches only. The Three.js adapter syncs `MeshStandardMaterial` / unlit from these records.

`CreateMaterialCommand` / `UpdateMaterialCommand` own library materials. `CreateMaterialInstanceCommand` / `UpdateMaterialInstanceCommand` own per-object overrides (`materialInstances`). `CreateTextureSetCommand` groups named channels (`baseColor`, `normal`, `metallicRoughness`, `emissive`, `occlusion`); `BindMaterialTextureSetCommand` copies those ids onto `textureBindings` and the legacy `*Texture` fields so both aliases stay in sync. `DeleteTextureSetCommand` drops the set and clears `textureSetId` on bound materials (undo restores both).

`emissive` / `emissiveColor` and `baseColor` / `color` stay equal after `createMaterialData` and `UpdateMaterialCommand` (`syncMaterialDualFields`). `textureBindings` and the legacy `*Texture` ids stay aligned the same way. Prefer `UpdateMaterialCommand` patches over writing the store.

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();
const cube = editor.spawn.cube({ size: 2 });
const mat = editor.createPbrMaterial({ name: "Paint" });
editor.updateMaterial(mat, { baseColor: [0.8, 0.2, 0.1, 1], roughness: 0.4, metallic: 0 });
const slot = cube.addMaterialSlot({ type: "material", materialId: mat }, "Fill");
cube.assignMaterialSlot(slot);
editor.dispose();
```

Face slots are per-mesh. `assignMaterialSlot` accepts a `MaterialSlotId` or a slot index. Unlit materials use `editor.createUnlitMaterial`.

See also: [Fluent editor](fluent-editor.md), [Formats](formats.md) (glTF PBR export), [Paint](paint-image.md).
