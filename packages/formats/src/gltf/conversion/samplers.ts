import type { FilterMode, MipmapFilterMode, TextureSampler, WrapMode } from "@modeling-kit/document";

const MAG_NEAREST = 9728;
const MAG_LINEAR = 9729;
const MIN_NEAREST = 9728;
const MIN_LINEAR = 9729;
const NEAREST_MIPMAP_NEAREST = 9984;
const LINEAR_MIPMAP_NEAREST = 9985;
const NEAREST_MIPMAP_LINEAR = 9986;
const LINEAR_MIPMAP_LINEAR = 9987;
const WRAP_REPEAT = 10497;
const WRAP_CLAMP = 33071;
const WRAP_MIRROR = 33648;

export function samplerFromGltf(
  magFilter: number | null,
  minFilter: number | null,
  wrapS: number,
  wrapT: number,
): TextureSampler {
  const mag: FilterMode = magFilter === MAG_NEAREST ? "nearest" : "linear";
  let min: FilterMode = "linear";
  let mipmap: MipmapFilterMode | undefined;
  switch (minFilter) {
    case MIN_NEAREST:
      min = "nearest";
      mipmap = "none";
      break;
    case MIN_LINEAR:
      min = "linear";
      mipmap = "none";
      break;
    case NEAREST_MIPMAP_NEAREST:
      min = "nearest";
      mipmap = "nearest";
      break;
    case LINEAR_MIPMAP_NEAREST:
      min = "linear";
      mipmap = "nearest";
      break;
    case NEAREST_MIPMAP_LINEAR:
      min = "nearest";
      mipmap = "linear";
      break;
    case LINEAR_MIPMAP_LINEAR:
      min = "linear";
      mipmap = "linear";
      break;
    default:
      break;
  }
  return {
    magFilter: mag,
    minFilter: min,
    wrapS: wrapFromGltf(wrapS),
    wrapT: wrapFromGltf(wrapT),
    ...(mipmap ? { mipmapFilter: mipmap } : {}),
  };
}

export function magFilterToGltf(filter: FilterMode): 9728 | 9729 {
  return filter === "nearest" ? MAG_NEAREST : MAG_LINEAR;
}

export function minFilterToGltf(sampler: TextureSampler): 9728 | 9729 | 9984 | 9985 | 9986 | 9987 {
  const mip = sampler.mipmapFilter;
  if (mip === "none" || mip === undefined) {
    return sampler.minFilter === "nearest" ? MIN_NEAREST : MIN_LINEAR;
  }
  if (sampler.minFilter === "nearest" && mip === "nearest") {
    return NEAREST_MIPMAP_NEAREST;
  }
  if (sampler.minFilter === "linear" && mip === "nearest") {
    return LINEAR_MIPMAP_NEAREST;
  }
  if (sampler.minFilter === "nearest" && mip === "linear") {
    return NEAREST_MIPMAP_LINEAR;
  }
  return LINEAR_MIPMAP_LINEAR;
}

export function wrapToGltf(wrap: WrapMode): 10497 | 33071 | 33648 {
  if (wrap === "clamp") {
    return WRAP_CLAMP;
  }
  if (wrap === "mirror") {
    return WRAP_MIRROR;
  }
  return WRAP_REPEAT;
}

function wrapFromGltf(value: number): WrapMode {
  if (value === WRAP_CLAMP) {
    return "clamp";
  }
  if (value === WRAP_MIRROR) {
    return "mirror";
  }
  return "repeat";
}
