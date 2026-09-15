import type { MaterialId, MaterialSlotId } from "@modeling-kit/core";
import type {
  MaterialAlphaMode,
  MaterialSlot,
  MaterialSlotTarget,
  StandardPBRMaterial,
  TextureBinding,
  UnlitMaterial,
} from "./types";
import { assertValidMaterial } from "./validation";

export interface CreateStandardPbrOptions {
  readonly id: MaterialId;
  readonly name?: string | undefined;
  readonly baseColor?: readonly [number, number, number, number] | undefined;
  readonly metallic?: number | undefined;
  readonly roughness?: number | undefined;
  readonly emissiveColor?: readonly [number, number, number] | undefined;
  readonly emissiveStrength?: number | undefined;
  readonly opacity?: number | undefined;
  readonly alphaMode?: MaterialAlphaMode | undefined;
  readonly alphaCutoff?: number | undefined;
  readonly doubleSided?: boolean | undefined;
  readonly normalScale?: number | undefined;
  readonly occlusionStrength?: number | undefined;
  readonly textureBindings?: Readonly<Record<string, TextureBinding | undefined>> | undefined;
  readonly metadata?: Record<string, unknown> | undefined;

  // Backwards compatibility options
  readonly baseColorFactor?: readonly [number, number, number, number] | undefined;
  readonly metallicFactor?: number | undefined;
  readonly roughnessFactor?: number | undefined;
  readonly emissiveFactor?: readonly [r: number, g: number, b: number] | undefined;
  readonly pixelArt?: boolean | undefined;
}

export function createStandardPbrMaterial(options: CreateStandardPbrOptions): StandardPBRMaterial {
  const baseColor = options.baseColor ?? options.baseColorFactor ?? [1, 1, 1, 1];
  const metallic = options.metallic ?? options.metallicFactor ?? 0;
  const roughness = options.roughness ?? options.roughnessFactor ?? 0.5;
  const emissiveColor = options.emissiveColor ?? options.emissiveFactor ?? [0, 0, 0];
  const alphaMode = (options.alphaMode?.toLowerCase() as MaterialAlphaMode) ?? "opaque";

  const material: StandardPBRMaterial = {
    type: "standard-pbr",
    id: options.id,
    name: options.name ?? "Material",
    baseColor,
    metallic,
    roughness,
    emissiveColor,
    emissiveStrength: options.emissiveStrength ?? 1,
    opacity: options.opacity ?? baseColor[3] ?? 1,
    alphaMode,
    alphaCutoff: options.alphaCutoff ?? 0.5,
    doubleSided: options.doubleSided ?? false,
    normalScale: options.normalScale ?? 1,
    occlusionStrength: options.occlusionStrength ?? 1,
    ...(options.textureBindings ? { textureBindings: options.textureBindings } : {}),
    metadata: options.metadata ? { ...options.metadata } : {},

    // Aliases
    emissive: emissiveColor,
    baseColorFactor: baseColor,
    metallicFactor: metallic,
    roughnessFactor: roughness,
    emissiveFactor: emissiveColor,
    ...(options.pixelArt !== undefined ? { pixelArt: options.pixelArt } : {}),
  };

  assertValidMaterial(material);
  return material;
}

export interface CreateUnlitOptions {
  readonly id: MaterialId;
  readonly name?: string | undefined;
  readonly color?: readonly [number, number, number, number] | undefined;
  readonly opacity?: number | undefined;
  readonly alphaMode?: MaterialAlphaMode | undefined;
  readonly doubleSided?: boolean | undefined;
  readonly textureBinding?: TextureBinding | undefined;
  readonly vertexColors?: boolean | undefined;
  readonly metadata?: Record<string, unknown> | undefined;

  // Backwards compatibility alias
  readonly baseColor?: readonly [number, number, number, number] | undefined;
}

export function createUnlitMaterial(options: CreateUnlitOptions): UnlitMaterial {
  const color = options.color ?? options.baseColor ?? [1, 1, 1, 1];
  const alphaMode = (options.alphaMode?.toLowerCase() as MaterialAlphaMode) ?? "opaque";

  const material: UnlitMaterial = {
    type: "unlit",
    id: options.id,
    name: options.name ?? "Unlit Material",
    color,
    opacity: options.opacity ?? color[3] ?? 1,
    alphaMode,
    doubleSided: options.doubleSided ?? false,
    vertexColors: options.vertexColors ?? false,
    ...(options.textureBinding ? { textureBinding: options.textureBinding } : {}),
    metadata: options.metadata ? { ...options.metadata } : {},

    // Alias
    baseColor: color,
  };

  assertValidMaterial(material);
  return material;
}

export function createMaterialSlot(
  id: MaterialSlotId,
  name = "Material Slot",
  target: MaterialSlotTarget,
): MaterialSlot {
  return {
    id,
    name,
    target,
    materialId: target.type === "material" ? target.materialId : null,
  };
}
