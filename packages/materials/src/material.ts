import { createStandardPbrMaterial, type CreateStandardPbrOptions } from "./factory";
import type { StandardPBRMaterial } from "./types";

export type CreatePbrMaterialOptions = CreateStandardPbrOptions;

export function createPbrMaterial(options: CreatePbrMaterialOptions): StandardPBRMaterial {
  return createStandardPbrMaterial(options);
}
