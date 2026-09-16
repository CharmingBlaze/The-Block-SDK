import type { Material as GltfMaterial, TextureInfo } from "@gltf-transform/core";
import { createMaterialData, type TextureBinding } from "@modeling-kit/document";
import { importTexture } from "./import-texture";
import type { GltfImportContext } from "./import-context";

function bindTexture(
  context: GltfImportContext,
  materialName: string,
  channel: string,
  texture: Parameters<typeof importTexture>[1] | null,
  info: TextureInfo | null,
  strength?: number,
): TextureBinding | undefined {
  if (!texture || !context.options.importTextures) {
    if (texture && !context.options.importTextures) {
      context.sink.loss("metadata-dropped", `Texture on ${materialName}.${channel} was not imported`);
    }
    return undefined;
  }
  const imported = importTexture(context, texture, info);
  if (!imported) {
    return undefined;
  }
  return {
    textureId: imported.id,
    ...(strength !== undefined ? { strength } : {}),
  };
}

export function importMaterial(context: GltfImportContext, material: GltfMaterial) {
  const existing = context.materialByGltf.get(material);
  if (existing) {
    return context.document.materials.get(existing);
  }
  const id = context.ids.material();
  const baseColor = material.getBaseColorFactor();
  const emissive = material.getEmissiveFactor();
  const alpha = material.getAlphaMode();
  const unlit = Boolean(material.getExtension("KHR_materials_unlit"));
  const baseColorBinding = bindTexture(
    context,
    material.getName(),
    "baseColor",
    material.getBaseColorTexture(),
    material.getBaseColorTextureInfo(),
  );
  const normalBinding = bindTexture(
    context,
    material.getName(),
    "normal",
    material.getNormalTexture(),
    material.getNormalTextureInfo(),
    material.getNormalScale(),
  );
  const mrBinding = bindTexture(
    context,
    material.getName(),
    "metallicRoughness",
    material.getMetallicRoughnessTexture(),
    material.getMetallicRoughnessTextureInfo(),
  );
  const emissiveBinding = bindTexture(
    context,
    material.getName(),
    "emissive",
    material.getEmissiveTexture(),
    material.getEmissiveTextureInfo(),
  );
  const occlusionBinding = bindTexture(
    context,
    material.getName(),
    "occlusion",
    material.getOcclusionTexture(),
    material.getOcclusionTextureInfo(),
    material.getOcclusionStrength(),
  );
  const data = createMaterialData(id, material.getName() || `Material ${context.materialByGltf.size}`, {
    type: unlit ? "unlit" : "standard-pbr",
    baseColor: [baseColor[0] ?? 1, baseColor[1] ?? 1, baseColor[2] ?? 1, baseColor[3] ?? 1],
    metallic: material.getMetallicFactor(),
    roughness: material.getRoughnessFactor(),
    emissive: [emissive[0] ?? 0, emissive[1] ?? 0, emissive[2] ?? 0],
    alphaMode: alpha === "MASK" ? "mask" : alpha === "BLEND" ? "blend" : "opaque",
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    normalScale: material.getNormalScale(),
    occlusionStrength: material.getOcclusionStrength(),
    ...(baseColorBinding?.textureId ? { baseColorTexture: baseColorBinding.textureId } : {}),
    ...(normalBinding?.textureId ? { normalTexture: normalBinding.textureId } : {}),
    ...(mrBinding?.textureId ? { metallicRoughnessTexture: mrBinding.textureId } : {}),
    ...(emissiveBinding?.textureId ? { emissiveTexture: emissiveBinding.textureId } : {}),
    ...(occlusionBinding?.textureId ? { occlusionTexture: occlusionBinding.textureId } : {}),
  });
  context.document.materials.set(data);
  context.materialByGltf.set(material, id);
  return data;
}
