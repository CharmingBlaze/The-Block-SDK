import { SchemaError, type MaterialId, type TextureId, type TextureSetId, type MaterialInstanceId } from "@modeling-kit/core";
import type {
  AlphaMode,
  FilterMode,
  MaterialData,
  MaterialInstance,
  TextureData,
  TextureSampler,
  TextureSet,
  TextureSetChannel,
  TextureBinding,
  WrapMode,
} from "./types";

export function defaultTextureSampler(pixelArt = false): TextureSampler {
  const filter: FilterMode = pixelArt ? "nearest" : "linear";
  return {
    magFilter: filter,
    minFilter: filter,
    wrapS: "repeat",
    wrapT: "repeat",
  };
}

export function createMaterialData(
  id: MaterialId,
  name = "Material",
  overrides: Partial<Omit<MaterialData, "id">> = {},
): MaterialData {
  const material: MaterialData = {
    id,
    name: overrides.name ?? name,
    ...(overrides.type ? { type: overrides.type } : {}),
    baseColor: overrides.baseColor ?? [0.8, 0.8, 0.82, 1],
    metallic: overrides.metallic ?? 0,
    roughness: overrides.roughness ?? 0.7,
    emissive: overrides.emissive ?? [0, 0, 0],
    ...(overrides.emissiveColor ? { emissiveColor: overrides.emissiveColor } : {}),
    ...(overrides.emissiveStrength !== undefined ? { emissiveStrength: overrides.emissiveStrength } : {}),
    ...(overrides.opacity !== undefined ? { opacity: overrides.opacity } : {}),
    ...(overrides.normalScale !== undefined ? { normalScale: overrides.normalScale } : {}),
    ...(overrides.occlusionStrength !== undefined ? { occlusionStrength: overrides.occlusionStrength } : {}),
    ...(overrides.color ? { color: overrides.color } : {}),
    ...(overrides.vertexColors !== undefined ? { vertexColors: overrides.vertexColors } : {}),
    alphaMode: overrides.alphaMode ?? "opaque",
    alphaCutoff: overrides.alphaCutoff ?? 0.5,
    doubleSided: overrides.doubleSided ?? true,
    pixelArt: overrides.pixelArt ?? false,
    metadata: overrides.metadata ?? {},
  };
  return syncMaterialDualFields(withOptionalTextures(material, overrides));
}

/**
 * Keep glTF factor names and unlit tints on the same values, and keep
 * `textureBindings` aligned with the legacy `*Texture` ids.
 */
export function syncMaterialDualFields(material: MaterialData): MaterialData {
  const tint = material.color ?? material.baseColor;
  const emit = material.emissiveColor ?? material.emissive;
  const bindings: Record<string, TextureBinding> = {};
  for (const [channel, binding] of Object.entries(material.textureBindings ?? {})) {
    if (binding) {
      bindings[channel] = binding;
    }
  }
  const applyChannel = (
    channel: TextureSetChannel,
    textureId: TextureId | undefined,
  ): TextureId | undefined => {
    const bound = bindings[channel]?.textureId ?? textureId;
    if (bound) {
      bindings[channel] = { ...(bindings[channel] ?? {}), textureId: bound };
    }
    return bound;
  };
  const baseColorTexture = applyChannel("baseColor", material.baseColorTexture);
  const normalTexture = applyChannel("normal", material.normalTexture);
  const metallicRoughnessTexture = applyChannel("metallicRoughness", material.metallicRoughnessTexture);
  const emissiveTexture = applyChannel("emissive", material.emissiveTexture);
  const occlusionTexture = applyChannel("occlusion", material.occlusionTexture);
  return {
    ...material,
    baseColor: tint,
    color: tint,
    emissive: emit,
    emissiveColor: emit,
    ...(Object.keys(bindings).length > 0 ? { textureBindings: bindings } : {}),
    ...(baseColorTexture ? { baseColorTexture } : {}),
    ...(normalTexture ? { normalTexture } : {}),
    ...(metallicRoughnessTexture ? { metallicRoughnessTexture } : {}),
    ...(emissiveTexture ? { emissiveTexture } : {}),
    ...(occlusionTexture ? { occlusionTexture } : {}),
  };
}

export function createTextureData(
  id: TextureId,
  name = "Texture",
  overrides: Partial<Omit<TextureData, "id">> = {},
): TextureData {
  const texture: TextureData = {
    id,
    name: overrides.name ?? name,
    colorSpace: overrides.colorSpace ?? "srgb",
    sampler: overrides.sampler ?? defaultTextureSampler(false),
    metadata: overrides.metadata ?? {},
  };
  return withOptionalTextureFields(texture, overrides);
}

export function createTextureSet(
  id: TextureSetId,
  name = "Texture Set",
  channels: Partial<Record<TextureSetChannel, TextureId>> = {},
): TextureSet {
  const textureIds = [...new Set(Object.values(channels).filter((id): id is TextureId => Boolean(id)))];
  return {
    id,
    name,
    channels,
    textureIds,
    metadata: {},
  };
}

export function materialFromTextureSet(material: MaterialData, set: TextureSet): MaterialData {
  const bindings = { ...(material.textureBindings ?? {}) };
  for (const [channel, textureId] of Object.entries(set.channels) as [TextureSetChannel, TextureId | undefined][]) {
    if (!textureId) {
      continue;
    }
    bindings[channel] = { ...(bindings[channel] ?? {}), textureId };
  }
  return {
    ...material,
    textureSetId: set.id,
    textureBindings: bindings,
    ...(set.channels.baseColor ? { baseColorTexture: set.channels.baseColor } : {}),
    ...(set.channels.normal ? { normalTexture: set.channels.normal } : {}),
    ...(set.channels.metallicRoughness ? { metallicRoughnessTexture: set.channels.metallicRoughness } : {}),
    ...(set.channels.emissive ? { emissiveTexture: set.channels.emissive } : {}),
    ...(set.channels.occlusion ? { occlusionTexture: set.channels.occlusion } : {}),
  };
}

export function createMaterialInstanceData(
  id: MaterialInstanceId,
  materialId: MaterialId,
  name = "Instance",
  overrides: Record<string, unknown> = {},
): MaterialInstance {
  return {
    id,
    name,
    materialId,
    parentMaterialId: materialId,
    overrides,
    metadata: {},
  };
}

export function normalizeMaterial(raw: unknown): MaterialData {
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new SchemaError("Material must have an id");
  }
  const type = raw.type === "unlit" ? "unlit" : raw.type === "standard-pbr" ? "standard-pbr" : undefined;
  const created = createMaterialData(
    raw.id as MaterialId,
    typeof raw.name === "string" ? raw.name : "Material",
    {
      name: typeof raw.name === "string" ? raw.name : "Material",
      ...(type ? { type } : {}),
      baseColor: parseVec4(raw.baseColor ?? raw.color, [0.8, 0.8, 0.82, 1]),
      metallic: num(raw.metallic, 0),
      roughness: num(raw.roughness, 0.7),
      emissive: parseVec3(raw.emissive ?? raw.emissiveColor, [0, 0, 0]),
      ...(Array.isArray(raw.emissiveColor) ? { emissiveColor: parseVec3(raw.emissiveColor, [0, 0, 0]) } : {}),
      ...(typeof raw.emissiveStrength === "number" ? { emissiveStrength: raw.emissiveStrength } : {}),
      ...(typeof raw.opacity === "number" ? { opacity: raw.opacity } : {}),
      ...(typeof raw.normalScale === "number" ? { normalScale: raw.normalScale } : {}),
      ...(typeof raw.occlusionStrength === "number" ? { occlusionStrength: raw.occlusionStrength } : {}),
      ...(Array.isArray(raw.color) ? { color: parseVec4(raw.color, [1, 1, 1, 1]) } : {}),
      ...(typeof raw.vertexColors === "boolean" ? { vertexColors: raw.vertexColors } : {}),
      alphaMode: parseAlpha(raw.alphaMode),
      alphaCutoff: num(raw.alphaCutoff, 0.5),
      doubleSided: raw.doubleSided !== false,
      pixelArt: raw.pixelArt === true,
      metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
      ...(typeof raw.baseColorTexture === "string"
        ? { baseColorTexture: raw.baseColorTexture as TextureId }
        : {}),
      ...(typeof raw.normalTexture === "string"
        ? { normalTexture: raw.normalTexture as TextureId }
        : {}),
      ...(typeof raw.metallicRoughnessTexture === "string"
        ? { metallicRoughnessTexture: raw.metallicRoughnessTexture as TextureId }
        : {}),
      ...(typeof raw.emissiveTexture === "string"
        ? { emissiveTexture: raw.emissiveTexture as TextureId }
        : {}),
      ...(typeof raw.occlusionTexture === "string"
        ? { occlusionTexture: raw.occlusionTexture as TextureId }
        : {}),
      ...(isRecord(raw.textureBindings)
        ? { textureBindings: parseTextureBindings(raw.textureBindings) }
        : {}),
      ...(typeof raw.textureSetId === "string" ? { textureSetId: raw.textureSetId as import("./types").TextureSet["id"] } : {}),
    },
  );
  return created;
}

export function normalizeTexture(raw: unknown): TextureData {
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new SchemaError("Texture must have an id");
  }
  return createTextureData(
    raw.id as TextureId,
    typeof raw.name === "string" ? raw.name : "Texture",
    {
      name: typeof raw.name === "string" ? raw.name : "Texture",
      colorSpace: raw.colorSpace === "linear" ? "linear" : "srgb",
      sampler: parseSampler(raw.sampler, raw.pixelArt === true),
      metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
      ...(typeof raw.samplerId === "string" ? { samplerId: raw.samplerId as import("@modeling-kit/core").SamplerId } : {}),
      ...(raw.sourceKind === "embedded" ||
      raw.sourceKind === "external" ||
      raw.sourceKind === "generated" ||
      raw.sourceKind === "image-document"
        ? { sourceKind: raw.sourceKind }
        : {}),
      ...(raw.usage === "color" || raw.usage === "normal" || raw.usage === "data" || raw.usage === "unknown"
        ? { usage: raw.usage }
        : {}),
      ...(typeof raw.imageDocumentId === "string"
        ? { imageDocumentId: raw.imageDocumentId as import("@modeling-kit/core").ImageDocumentId }
        : {}),
      ...(typeof raw.uri === "string" ? { uri: raw.uri } : {}),
      ...(typeof raw.mimeType === "string" ? { mimeType: raw.mimeType } : {}),
      ...(typeof raw.width === "number" ? { width: raw.width } : {}),
      ...(typeof raw.height === "number" ? { height: raw.height } : {}),
      ...(typeof raw.pixelsBase64 === "string" ? { pixelsBase64: raw.pixelsBase64 } : {}),
    },
  );
}

function withOptionalTextures(
  material: MaterialData,
  overrides: Partial<MaterialData>,
): MaterialData {
  return {
    ...material,
    ...(overrides.baseColorTexture !== undefined
      ? { baseColorTexture: overrides.baseColorTexture }
      : {}),
    ...(overrides.normalTexture !== undefined ? { normalTexture: overrides.normalTexture } : {}),
    ...(overrides.metallicRoughnessTexture !== undefined
      ? { metallicRoughnessTexture: overrides.metallicRoughnessTexture }
      : {}),
    ...(overrides.emissiveTexture !== undefined
      ? { emissiveTexture: overrides.emissiveTexture }
      : {}),
    ...(overrides.occlusionTexture !== undefined
      ? { occlusionTexture: overrides.occlusionTexture }
      : {}),
    ...(overrides.textureBindings !== undefined ? { textureBindings: overrides.textureBindings } : {}),
    ...(overrides.textureSetId !== undefined ? { textureSetId: overrides.textureSetId } : {}),
  };
}

function withOptionalTextureFields(
  texture: TextureData,
  overrides: Partial<TextureData>,
): TextureData {
  return {
    ...texture,
    ...(overrides.uri !== undefined ? { uri: overrides.uri } : {}),
    ...(overrides.mimeType !== undefined ? { mimeType: overrides.mimeType } : {}),
    ...(overrides.width !== undefined ? { width: overrides.width } : {}),
    ...(overrides.height !== undefined ? { height: overrides.height } : {}),
    ...(overrides.pixelsBase64 !== undefined ? { pixelsBase64: overrides.pixelsBase64 } : {}),
    ...(overrides.samplerId !== undefined ? { samplerId: overrides.samplerId } : {}),
    ...(overrides.sourceKind !== undefined ? { sourceKind: overrides.sourceKind } : {}),
    ...(overrides.usage !== undefined ? { usage: overrides.usage } : {}),
    ...(overrides.imageDocumentId !== undefined ? { imageDocumentId: overrides.imageDocumentId } : {}),
  };
}

function parseTextureBindings(
  raw: Record<string, unknown>,
): NonNullable<MaterialData["textureBindings"]> {
  const out: Record<string, import("./types").TextureBinding> = {};
  for (const [channel, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      continue;
    }
    out[channel] = {
      ...(typeof value.textureId === "string" ? { textureId: value.textureId as TextureId } : {}),
      ...(typeof value.uvChannelId === "string"
        ? { uvChannelId: value.uvChannelId as import("@modeling-kit/core").UVChannelId }
        : {}),
      ...(typeof value.samplerId === "string"
        ? { samplerId: value.samplerId as import("@modeling-kit/core").SamplerId }
        : {}),
      ...(value.colorSpace === "srgb" || value.colorSpace === "linear"
        ? { colorSpace: value.colorSpace }
        : {}),
      ...(typeof value.strength === "number" ? { strength: value.strength } : {}),
      ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
      ...(isRecord(value.transform)
        ? {
            transform: {
              offset: parseVec2(value.transform.offset, [0, 0]),
              scale: parseVec2(value.transform.scale, [1, 1]),
              rotation: num(value.transform.rotation, 0),
            },
          }
        : {}),
    };
  }
  return out;
}

function parseVec2(
  value: unknown,
  fallback: readonly [number, number],
): readonly [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [num(value[0], fallback[0]), num(value[1], fallback[1])];
  }
  return fallback;
}

function parseSampler(raw: unknown, pixelArt: boolean): TextureSampler {
  if (!isRecord(raw)) {
    return defaultTextureSampler(pixelArt);
  }
  return {
    magFilter: parseFilter(raw.magFilter, pixelArt ? "nearest" : "linear"),
    minFilter: parseFilter(raw.minFilter, pixelArt ? "nearest" : "linear"),
    wrapS: parseWrap(raw.wrapS),
    wrapT: parseWrap(raw.wrapT),
  };
}

function parseFilter(value: unknown, fallback: FilterMode): FilterMode {
  return value === "nearest" || value === "linear" ? value : fallback;
}

function parseWrap(value: unknown): WrapMode {
  return value === "clamp" || value === "mirror" || value === "repeat" ? value : "repeat";
}

function parseAlpha(value: unknown): AlphaMode {
  return value === "mask" || value === "blend" || value === "opaque" ? value : "opaque";
}

function parseVec4(
  value: unknown,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  if (Array.isArray(value) && value.length >= 4) {
    return [
      num(value[0], fallback[0]),
      num(value[1], fallback[1]),
      num(value[2], fallback[2]),
      num(value[3], fallback[3]),
    ];
  }
  return fallback;
}

function parseVec3(
  value: unknown,
  fallback: readonly [number, number, number],
): readonly [number, number, number] {
  if (Array.isArray(value) && value.length >= 3) {
    return [num(value[0], fallback[0]), num(value[1], fallback[1]), num(value[2], fallback[2])];
  }
  return fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
