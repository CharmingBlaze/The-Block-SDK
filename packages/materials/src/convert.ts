import type { MaterialData, MaterialInstance as DocumentMaterialInstance } from "@modeling-kit/document";
import type { MaterialDefinition, MaterialInstance, StandardPBRMaterial, UnlitMaterial } from "./types";

export function materialDataToDefinition(data: MaterialData): MaterialDefinition {
  if (data.type === "unlit") {
    const color = data.color ?? data.baseColor;
    const unlit: UnlitMaterial = {
      type: "unlit",
      id: data.id,
      name: data.name,
      color,
      opacity: data.opacity ?? color[3] ?? 1,
      alphaMode: data.alphaMode,
      doubleSided: data.doubleSided,
      vertexColors: data.vertexColors ?? false,
      metadata: data.metadata,
      baseColor: color,
      ...(data.textureBindings?.baseColor ? { textureBinding: data.textureBindings.baseColor } : {}),
    };
    return unlit;
  }
  const pbr: StandardPBRMaterial = {
    type: "standard-pbr",
    id: data.id,
    name: data.name,
    baseColor: data.baseColor,
    metallic: data.metallic,
    roughness: data.roughness,
    emissiveColor: data.emissiveColor ?? data.emissive,
    emissiveStrength: data.emissiveStrength ?? 1,
    opacity: data.opacity ?? data.baseColor[3] ?? 1,
    alphaMode: data.alphaMode,
    alphaCutoff: data.alphaCutoff,
    doubleSided: data.doubleSided,
    normalScale: data.normalScale ?? 1,
    occlusionStrength: data.occlusionStrength ?? 1,
    metadata: data.metadata,
    emissive: data.emissive,
    baseColorFactor: data.baseColor,
    metallicFactor: data.metallic,
    roughnessFactor: data.roughness,
    emissiveFactor: data.emissiveColor ?? data.emissive,
    pixelArt: data.pixelArt,
    ...(data.textureBindings ? { textureBindings: data.textureBindings } : {}),
  };
  return pbr;
}

export function materialDefinitionToData(definition: MaterialDefinition): MaterialData {
  if (definition.type === "unlit") {
    return {
      id: definition.id,
      name: definition.name,
      type: "unlit",
      baseColor: definition.color,
      metallic: 0,
      roughness: 1,
      emissive: [0, 0, 0],
      color: definition.color,
      opacity: definition.opacity,
      alphaMode: definition.alphaMode,
      alphaCutoff: 0.5,
      doubleSided: definition.doubleSided,
      vertexColors: definition.vertexColors,
      pixelArt: false,
      metadata: definition.metadata,
      ...(definition.textureBinding ? { textureBindings: { baseColor: definition.textureBinding } } : {}),
    };
  }
  return {
    id: definition.id,
    name: definition.name,
    type: "standard-pbr",
    baseColor: definition.baseColor,
    metallic: definition.metallic,
    roughness: definition.roughness,
    emissive: definition.emissiveColor,
    emissiveColor: definition.emissiveColor,
    emissiveStrength: definition.emissiveStrength,
    opacity: definition.opacity,
    alphaMode: definition.alphaMode,
    alphaCutoff: definition.alphaCutoff,
    doubleSided: definition.doubleSided,
    normalScale: definition.normalScale,
    occlusionStrength: definition.occlusionStrength,
    pixelArt: definition.pixelArt ?? false,
    metadata: definition.metadata,
    ...(definition.textureBindings ? { textureBindings: definition.textureBindings } : {}),
  };
}

export function documentInstanceToLibrary(instance: DocumentMaterialInstance): MaterialInstance {
  return {
    type: "material-instance",
    id: instance.id,
    name: instance.name,
    parentMaterialId: instance.parentMaterialId ?? instance.materialId,
    overrides: (instance.overrides ?? {}) as MaterialInstance["overrides"],
    metadata: instance.metadata,
  };
}

export function libraryInstanceToDocument(instance: MaterialInstance): DocumentMaterialInstance {
  return {
    id: instance.id,
    name: instance.name,
    materialId: instance.parentMaterialId,
    parentMaterialId: instance.parentMaterialId,
    overrides: instance.overrides as Record<string, unknown>,
    metadata: instance.metadata,
  };
}
