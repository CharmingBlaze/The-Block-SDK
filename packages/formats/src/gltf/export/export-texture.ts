import { base64ToBytes, type TextureData } from "@modeling-kit/document";
import type { GltfExportContext } from "./export-context";

export function exportTexture(context: GltfExportContext, texture: TextureData) {
  if (!context.options.exportTextures) {
    return undefined;
  }
  const existing = context.textureById.get(texture.id);
  if (existing) {
    return existing;
  }
  const bytes = texture.encodedBytesBase64 ? base64ToBytes(texture.encodedBytesBase64) : undefined;
  if (!bytes) {
    context.sink.loss("texture-format-unsupported", `Texture '${texture.name}' has no encoded bytes to export`, {
      affectedObject: texture.id,
      suggestedCorrection: "Preserve encodedBytesBase64 on import",
    });
    return undefined;
  }
  const gltfTexture = context.target.createTexture(texture.name).setImage(bytes).setMimeType(texture.mimeType ?? "image/png");
  context.textureById.set(texture.id, gltfTexture);
  return gltfTexture;
}
