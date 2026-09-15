import type { PrimitiveType } from "./types";

/** Document/scene strings that must map onto `@modeling-kit/primitives` catalog types. */
export const PRIMITIVE_TYPE_ALIASES: Readonly<Record<string, PrimitiveType>> = {
  cube: "box",
  "uv-sphere": "uvSphere",
  uvsphere: "uvSphere",
  UVSphere: "uvSphere",
  sphere: "uvSphere",
  "ico-sphere": "icosphere",
  icoSphere: "icosphere",
  Icosphere: "icosphere",
  pryamid: "pyramid",
  Pyramid: "pyramid",
};

export function resolvePrimitiveType(type: string): PrimitiveType {
  return (PRIMITIVE_TYPE_ALIASES[type] ?? type) as PrimitiveType;
}

export function canonicalizePrimitiveType(type: string): PrimitiveType {
  return resolvePrimitiveType(type);
}
