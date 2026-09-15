import type { StandardPBRMaterial, UnlitMaterial } from "./types";

export interface MaterialValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

export function validateStandardPbrMaterial(material: StandardPBRMaterial): MaterialValidationResult {
  const errors: string[] = [];

  if (!material.id || typeof material.id !== "string") {
    errors.push("Material id must be a non-empty string");
  }

  if (typeof material.name !== "string") {
    errors.push("Material name must be a string");
  }

  if (material.type !== "standard-pbr") {
    errors.push(`Invalid material type '${(material as { type?: unknown }).type}', expected 'standard-pbr'`);
  }

  // baseColor: [r, g, b, a] in [0, 1]
  if (!Array.isArray(material.baseColor) || material.baseColor.length !== 4) {
    errors.push("baseColor must be a 4-element tuple [r, g, b, a]");
  } else {
    for (let i = 0; i < 4; i++) {
      const channel = material.baseColor[i];
      if (!isFiniteNumber(channel) || !inRange(channel, 0, 1)) {
        errors.push(`baseColor[${i}] must be a finite number between 0 and 1, received ${channel}`);
      }
    }
  }

  // metallic: [0, 1]
  if (!isFiniteNumber(material.metallic) || !inRange(material.metallic, 0, 1)) {
    errors.push(`metallic must be a finite number between 0 and 1, received ${material.metallic}`);
  }

  // roughness: [0, 1]
  if (!isFiniteNumber(material.roughness) || !inRange(material.roughness, 0, 1)) {
    errors.push(`roughness must be a finite number between 0 and 1, received ${material.roughness}`);
  }

  // emissiveColor: [r, g, b] >= 0
  if (!Array.isArray(material.emissiveColor) || material.emissiveColor.length !== 3) {
    errors.push("emissiveColor must be a 3-element tuple [r, g, b]");
  } else {
    for (let i = 0; i < 3; i++) {
      const channel = material.emissiveColor[i];
      if (!isFiniteNumber(channel) || channel < 0) {
        errors.push(`emissiveColor[${i}] must be a non-negative finite number, received ${channel}`);
      }
    }
  }

  // emissiveStrength: >= 0
  if (!isFiniteNumber(material.emissiveStrength) || material.emissiveStrength < 0) {
    errors.push(`emissiveStrength must be a non-negative finite number, received ${material.emissiveStrength}`);
  }

  // opacity: [0, 1]
  if (!isFiniteNumber(material.opacity) || !inRange(material.opacity, 0, 1)) {
    errors.push(`opacity must be a finite number between 0 and 1, received ${material.opacity}`);
  }

  // alphaMode: "opaque" | "mask" | "blend"
  const validAlphaModes = ["opaque", "mask", "blend"];
  if (!validAlphaModes.includes(material.alphaMode)) {
    errors.push(`alphaMode must be one of 'opaque', 'mask', 'blend', received '${material.alphaMode}'`);
  }

  // alphaCutoff: [0, 1]
  if (!isFiniteNumber(material.alphaCutoff) || !inRange(material.alphaCutoff, 0, 1)) {
    errors.push(`alphaCutoff must be a finite number between 0 and 1, received ${material.alphaCutoff}`);
  }

  // doubleSided: boolean
  if (typeof material.doubleSided !== "boolean") {
    errors.push(`doubleSided must be a boolean, received ${typeof material.doubleSided}`);
  }

  // normalScale: finite number
  if (!isFiniteNumber(material.normalScale)) {
    errors.push(`normalScale must be a finite number, received ${material.normalScale}`);
  }

  // occlusionStrength: [0, 1]
  if (!isFiniteNumber(material.occlusionStrength) || !inRange(material.occlusionStrength, 0, 1)) {
    errors.push(`occlusionStrength must be a finite number between 0 and 1, received ${material.occlusionStrength}`);
  }

  if (material.textureBindings) {
    errors.push(...validateTextureBindings(material.textureBindings));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateUnlitMaterial(material: UnlitMaterial): MaterialValidationResult {
  const errors: string[] = [];

  if (!material.id || typeof material.id !== "string") {
    errors.push("Material id must be a non-empty string");
  }

  if (typeof material.name !== "string") {
    errors.push("Material name must be a string");
  }

  if (material.type !== "unlit") {
    errors.push(`Invalid material type '${(material as { type?: unknown }).type}', expected 'unlit'`);
  }

  // color: [r, g, b, a] in [0, 1]
  if (!Array.isArray(material.color) || material.color.length !== 4) {
    errors.push("color must be a 4-element tuple [r, g, b, a]");
  } else {
    for (let i = 0; i < 4; i++) {
      const channel = material.color[i];
      if (!isFiniteNumber(channel) || !inRange(channel, 0, 1)) {
        errors.push(`color[${i}] must be a finite number between 0 and 1, received ${channel}`);
      }
    }
  }

  // opacity: [0, 1]
  if (!isFiniteNumber(material.opacity) || !inRange(material.opacity, 0, 1)) {
    errors.push(`opacity must be a finite number between 0 and 1, received ${material.opacity}`);
  }

  // alphaMode: "opaque" | "mask" | "blend"
  const validAlphaModes = ["opaque", "mask", "blend"];
  if (!validAlphaModes.includes(material.alphaMode)) {
    errors.push(`alphaMode must be one of 'opaque', 'mask', 'blend', received '${material.alphaMode}'`);
  }

  // doubleSided: boolean
  if (typeof material.doubleSided !== "boolean") {
    errors.push(`doubleSided must be a boolean, received ${typeof material.doubleSided}`);
  }

  // vertexColors: boolean
  if (typeof material.vertexColors !== "boolean") {
    errors.push(`vertexColors must be a boolean, received ${typeof material.vertexColors}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateMaterialDefinition(material: unknown): MaterialValidationResult {
  if (!material || typeof material !== "object") {
    return { valid: false, errors: ["Material must be an object"] };
  }
  const mat = material as { type?: unknown };
  if (mat.type === "unlit") {
    return validateUnlitMaterial(material as UnlitMaterial);
  }
  if (mat.type === "standard-pbr" || mat.type === undefined) {
    return validateStandardPbrMaterial(material as StandardPBRMaterial);
  }
  return {
    valid: false,
    errors: [`Unsupported material type '${String(mat.type)}'. Supported types: 'standard-pbr', 'unlit'`],
  };
}

export function assertValidMaterial(material: unknown): void {
  const result = validateMaterialDefinition(material);
  if (!result.valid) {
    throw new RangeError(`Material validation failed:\n - ${result.errors.join("\n - ")}`);
  }
}

function validateTextureBindings(
  bindings: Readonly<Record<string, { readonly colorSpace?: string | undefined; readonly transform?: { readonly rotation?: number; readonly offset?: readonly number[]; readonly scale?: readonly number[] } | undefined } | undefined>>,
): string[] {
  const errors: string[] = [];
  for (const [channel, binding] of Object.entries(bindings)) {
    if (!binding) {
      continue;
    }
    if (channel === "normal" && binding.colorSpace === "srgb") {
      errors.push("normal map texture binding must not use sRGB color space");
    }
    if (
      (channel === "metallicRoughness" || channel === "occlusion") &&
      binding.colorSpace === "srgb"
    ) {
      errors.push(`${channel} texture binding must not use sRGB color space`);
    }
    const transform = binding.transform;
    if (transform) {
      if (transform.rotation !== undefined && !isFiniteNumber(transform.rotation)) {
        errors.push(`${channel} texture rotation must be finite`);
      }
      for (const axis of transform.offset ?? []) {
        if (!isFiniteNumber(axis)) {
          errors.push(`${channel} texture offset must be finite`);
        }
      }
      for (const axis of transform.scale ?? []) {
        if (!isFiniteNumber(axis)) {
          errors.push(`${channel} texture scale must be finite`);
        }
      }
    }
  }
  return errors;
}
