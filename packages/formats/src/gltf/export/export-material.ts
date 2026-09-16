import type { Texture as GltfTexture } from "@gltf-transform/core";
import type { MaterialData } from "@modeling-kit/document";
import type { GltfExportContext } from "./export-context";
import { applySampler } from "./export-sampler";
import { exportTexture } from "./export-texture";

export function exportMaterial(context: GltfExportContext, material: MaterialData) {
  if (!context.options.exportMaterials) {
    return undefined;
  }
  const existing = context.materialById.get(material.id);
  if (existing) {
    return existing;
  }
  const gltf = context.target.createMaterial(material.name);
  gltf.setBaseColorFactor([...material.baseColor] as [number, number, number, number]);
  gltf.setMetallicFactor(material.metallic);
  gltf.setRoughnessFactor(material.roughness);
  gltf.setEmissiveFactor([...material.emissive] as [number, number, number]);
  gltf.setDoubleSided(material.doubleSided);
  gltf.setAlphaCutoff(material.alphaCutoff);
  gltf.setAlphaMode(material.alphaMode === "mask" ? "MASK" : material.alphaMode === "blend" ? "BLEND" : "OPAQUE");
  bind(context, gltf.setBaseColorTexture.bind(gltf), gltf.getBaseColorTextureInfo.bind(gltf), material.baseColorTexture);
  bind(context, gltf.setNormalTexture.bind(gltf), gltf.getNormalTextureInfo.bind(gltf), material.normalTexture);
  bind(
    context,
    gltf.setMetallicRoughnessTexture.bind(gltf),
    gltf.getMetallicRoughnessTextureInfo.bind(gltf),
    material.metallicRoughnessTexture,
  );
  bind(context, gltf.setEmissiveTexture.bind(gltf), gltf.getEmissiveTextureInfo.bind(gltf), material.emissiveTexture);
  bind(context, gltf.setOcclusionTexture.bind(gltf), gltf.getOcclusionTextureInfo.bind(gltf), material.occlusionTexture);
  if (material.normalScale !== undefined) {
    gltf.setNormalScale(material.normalScale);
  }
  if (material.occlusionStrength !== undefined) {
    gltf.setOcclusionStrength(material.occlusionStrength);
  }
  context.materialById.set(material.id, gltf);
  return gltf;
}

function bind(
  context: GltfExportContext,
  setTexture: (texture: GltfTexture | null) => unknown,
  getInfo: () => import("@gltf-transform/core").TextureInfo | null,
  textureId: string | undefined,
): void {
  if (!textureId) {
    return;
  }
  const texture = context.document.textures.get(textureId as never);
  if (!texture) {
    return;
  }
  const exported = exportTexture(context, texture);
  if (!exported) {
    return;
  }
  setTexture(exported);
  const info = getInfo();
  if (info) {
    applySampler(info, texture);
  }
}
