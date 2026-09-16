import type { TextureInfo } from "@gltf-transform/core";
import type { TextureSampler } from "@modeling-kit/document";
import { samplerFromGltf } from "../conversion/samplers";

export function importSampler(info: TextureInfo | null): TextureSampler | undefined {
  if (!info) {
    return undefined;
  }
  return samplerFromGltf(info.getMagFilter(), info.getMinFilter(), info.getWrapS(), info.getWrapT());
}
