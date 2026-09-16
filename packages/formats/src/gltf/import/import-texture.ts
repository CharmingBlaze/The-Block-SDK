import type { Texture as GltfTexture, TextureInfo } from "@gltf-transform/core";
import { bytesToBase64, createTextureData } from "@modeling-kit/document";
import { isSupportedImageMime } from "../resources/mime-types";
import { samplerFromGltf } from "../conversion/samplers";
import type { GltfImportContext } from "./import-context";

export function importTexture(
  context: GltfImportContext,
  texture: GltfTexture,
  info: TextureInfo | null,
): ReturnType<typeof createTextureData> | undefined {
  const existing = context.textureByGltf.get(texture);
  if (existing) {
    return context.document.textures.get(existing);
  }
  const image = texture.getImage();
  const mimeType = texture.getMimeType() || "application/octet-stream";
  if (image && !isSupportedImageMime(mimeType)) {
    context.sink.loss("texture-format-unsupported", `Texture '${texture.getName()}' uses unsupported MIME ${mimeType}`, {
      sourcePath: "textures",
      affectedObject: texture.getName(),
      suggestedCorrection: "Convert the image to PNG, JPEG, or WebP",
    });
  }
  const sampler = info
    ? samplerFromGltf(info.getMagFilter(), info.getMinFilter(), info.getWrapS(), info.getWrapT())
    : undefined;
  const id = context.ids.texture();
  const data = createTextureData(id, texture.getName() || `Texture ${context.textureByGltf.size}`, {
    sourceKind: "embedded",
    mimeType,
    ...(sampler ? { sampler } : {}),
    ...(image ? { encodedBytesBase64: bytesToBase64(image) } : {}),
  });
  context.document.textures.set(data);
  context.textureByGltf.set(texture, id);
  return data;
}
