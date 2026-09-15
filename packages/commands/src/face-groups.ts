import { brand, type FaceId } from "@modeling-kit/core";
import type { PrimitiveFaceGroups } from "@modeling-kit/primitives";

export const FACE_GROUPS_METADATA_KEY = "faceGroups";

const GROUP_KEYS = ["top", "bottom", "front", "back", "sides", "caps"] as const;

export type SemanticFaceTag = (typeof GROUP_KEYS)[number] | "all" | "left" | "right";

export function serializeFaceGroups(groups: PrimitiveFaceGroups): Record<string, unknown> {
  return {
    top: [...groups.top],
    bottom: [...groups.bottom],
    front: [...groups.front],
    back: [...groups.back],
    sides: [...groups.sides],
    caps: [...groups.caps],
    ...(groups.posX ? { posX: groups.posX } : {}),
    ...(groups.negX ? { negX: groups.negX } : {}),
    ...(groups.posY ? { posY: groups.posY } : {}),
    ...(groups.negY ? { negY: groups.negY } : {}),
    ...(groups.posZ ? { posZ: groups.posZ } : {}),
    ...(groups.negZ ? { negZ: groups.negZ } : {}),
  };
}

export function parseFaceGroups(metadata: Record<string, unknown>): PrimitiveFaceGroups | undefined {
  const raw = metadata[FACE_GROUPS_METADATA_KEY];
  if (!isRecord(raw)) {
    return undefined;
  }
  return {
    top: asFaceIds(raw.top),
    bottom: asFaceIds(raw.bottom),
    front: asFaceIds(raw.front),
    back: asFaceIds(raw.back),
    sides: asFaceIds(raw.sides),
    caps: asFaceIds(raw.caps),
    ...(typeof raw.posX === "string" ? { posX: brand<string, "FaceId">(raw.posX) } : {}),
    ...(typeof raw.negX === "string" ? { negX: brand<string, "FaceId">(raw.negX) } : {}),
    ...(typeof raw.posY === "string" ? { posY: brand<string, "FaceId">(raw.posY) } : {}),
    ...(typeof raw.negY === "string" ? { negY: brand<string, "FaceId">(raw.negY) } : {}),
    ...(typeof raw.posZ === "string" ? { posZ: brand<string, "FaceId">(raw.posZ) } : {}),
    ...(typeof raw.negZ === "string" ? { negZ: brand<string, "FaceId">(raw.negZ) } : {}),
  };
}

export function matchingFaceTags(
  groups: PrimitiveFaceGroups | undefined,
  faceIds: readonly string[],
): string[] {
  if (!groups || faceIds.length === 0) {
    return [];
  }
  const selected = new Set(faceIds);
  const tags: string[] = [];
  for (const key of GROUP_KEYS) {
    const group = groups[key];
    if (group.length === 0) {
      continue;
    }
    if (faceIds.every((id) => group.includes(id as FaceId)) && group.some((id) => selected.has(id))) {
      tags.push(key);
    }
  }
  return tags;
}

function asFaceIds(value: unknown): FaceId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === "string").map((id) => brand<string, "FaceId">(id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
