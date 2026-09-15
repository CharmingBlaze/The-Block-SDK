/** Document `MaterialData` is canonical. `createPbrMaterial` is a convenience DTO. */
export {
  createMaterialData,
  createTextureData,
  defaultTextureSampler,
  normalizeMaterial,
  normalizeTexture,
} from "@modeling-kit/document";

export {
  assignFaceMaterialSlot,
  assignMaterialSlots,
  addSlotToRecord,
  reorderSlotsInRecord,
  syncMeshSlotIndices,
} from "./slots";

export {
  createStandardPbrMaterial,
  createUnlitMaterial,
  createMaterialSlot,
  type CreateStandardPbrOptions,
  type CreateUnlitOptions,
} from "./factory";

export {
  createPbrMaterial,
  type CreatePbrMaterialOptions,
} from "./material";

export {
  validateStandardPbrMaterial,
  validateUnlitMaterial,
  validateMaterialDefinition,
  assertValidMaterial,
  type MaterialValidationResult,
} from "./validation";

export { MaterialLibrary } from "./material-library";
export {
  documentInstanceToLibrary,
  libraryInstanceToDocument,
  materialDataToDefinition,
  materialDefinitionToData,
} from "./convert";

export type {
  AlphaMode,
  MaterialAlphaMode,
  MaterialDefinition,
  MaterialInstance,
  MaterialSlot,
  MaterialSlotTarget,
  MeshFace,
  PbrMaterialData,
  StandardPBRMaterial,
  TextureBinding,
  TextureTransform,
  UnlitMaterial,
} from "./types";
