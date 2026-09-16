import type { TextureInfo } from "@gltf-transform/core";
import type { TextureData } from "@modeling-kit/document";
import { magFilterToGltf, minFilterToGltf, wrapToGltf } from "../conversion/samplers";

export function applySampler(info: TextureInfo, texture: TextureData): void {
  info.setMagFilter(magFilterToGltf(texture.sampler.magFilter) as 9728 | 9729);
  info.setMinFilter(minFilterToGltf(texture.sampler) as 9728 | 9729 | 9984 | 9985 | 9986 | 9987);
  info.setWrapS(wrapToGltf(texture.sampler.wrapS) as 10497 | 33071 | 33648);
  info.setWrapT(wrapToGltf(texture.sampler.wrapT) as 10497 | 33071 | 33648);
}
