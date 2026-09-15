import {
  SchemaError,
  type AnimationId,
  type BoneId,
  type SkeletonId,
  type VertexId,
} from "@modeling-kit/core";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type {
  AnimationChannel,
  AnimationClipData,
  AnimationInterpolation,
  AnimationKeyframe,
  AnimationLoopMode,
  AnimationTargetKind,
  AnimationTrackData,
  BoneData,
  MeshSkinBinding,
  SkeletonData,
  SkinInfluence,
  TimelineMarker,
  VertexSkinData,
} from "./types";

export function createBoneData(
  id: BoneId,
  name: string,
  overrides: Partial<Omit<BoneData, "id">> = {},
): BoneData {
  return {
    id,
    name: overrides.name ?? name,
    parentId: overrides.parentId ?? null,
    restTransform: overrides.restTransform ?? identityTransform(),
    visible: overrides.visible !== false,
    locked: overrides.locked === true,
    metadata: overrides.metadata ?? {},
  };
}

export function createSkeletonData(
  id: SkeletonId,
  name = "Skeleton",
  bones: readonly BoneData[] = [],
): SkeletonData {
  return { id, name, bones, metadata: {} };
}

export function createAnimationClipData(
  id: AnimationId,
  name = "Clip",
  overrides: Partial<Omit<AnimationClipData, "id">> = {},
): AnimationClipData {
  return {
    id,
    name: overrides.name ?? name,
    duration: overrides.duration ?? 1,
    loopMode: overrides.loopMode ?? "once",
    tracks: overrides.tracks ?? [],
    markers: overrides.markers ?? [],
    metadata: overrides.metadata ?? {},
  };
}

export function normalizeSkeleton(raw: unknown): SkeletonData {
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new SchemaError("Skeleton must have an id");
  }
  const bonesRaw = Array.isArray(raw.bones) ? raw.bones : [];
  return {
    id: raw.id as SkeletonId,
    name: typeof raw.name === "string" ? raw.name : "Skeleton",
    bones: bonesRaw.map((item) => normalizeBone(item)),
    metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
  };
}

export function normalizeClip(raw: unknown): AnimationClipData {
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new SchemaError("Animation clip must have an id");
  }
  const tracksRaw = Array.isArray(raw.tracks) ? raw.tracks : [];
  const markersRaw = Array.isArray(raw.markers) ? raw.markers : [];
  return {
    id: raw.id as AnimationId,
    name: typeof raw.name === "string" ? raw.name : "Clip",
    duration: typeof raw.duration === "number" && Number.isFinite(raw.duration) ? raw.duration : 1,
    loopMode: parseLoop(raw.loopMode),
    tracks: tracksRaw.map((item, index) => normalizeTrack(item, index)),
    markers: markersRaw.map((item) => normalizeMarker(item)),
    metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
  };
}

export function normalizeSkin(raw: unknown): MeshSkinBinding | undefined {
  if (!isRecord(raw) || typeof raw.skeletonId !== "string") {
    return undefined;
  }
  const verticesRaw = Array.isArray(raw.vertices) ? raw.vertices : [];
  return {
    skeletonId: raw.skeletonId as SkeletonId,
    maxInfluences: typeof raw.maxInfluences === "number" ? raw.maxInfluences : 4,
    vertices: verticesRaw.map((item) => normalizeVertexSkin(item)),
  };
}

function normalizeBone(raw: unknown): BoneData {
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new SchemaError("Bone must have an id");
  }
  return {
    id: raw.id as BoneId,
    name: typeof raw.name === "string" ? raw.name : raw.id,
    parentId: typeof raw.parentId === "string" ? (raw.parentId as BoneId) : null,
    restTransform: parseTransform(raw.restTransform),
    visible: raw.visible !== false,
    locked: raw.locked === true,
    metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
  };
}

function normalizeTrack(raw: unknown, index: number): AnimationTrackData {
  if (!isRecord(raw)) {
    throw new SchemaError("Animation track must be an object");
  }
  const keysRaw = Array.isArray(raw.keys) ? raw.keys : [];
  return {
    id: typeof raw.id === "string" ? raw.id : `track-${index}`,
    targetKind: raw.targetKind === "object" ? "object" : "bone",
    targetId: typeof raw.targetId === "string" ? raw.targetId : "",
    channel: parseChannel(raw.channel),
    interpolation: parseInterp(raw.interpolation),
    keys: keysRaw.map((item) => normalizeKey(item)),
  };
}

function normalizeKey(raw: unknown): AnimationKeyframe {
  if (!isRecord(raw) || typeof raw.time !== "number") {
    throw new SchemaError("Keyframe must have a numeric time");
  }
  const value = Array.isArray(raw.value)
    ? raw.value.filter((n): n is number => typeof n === "number")
    : [];
  return { time: raw.time, value };
}

function normalizeMarker(raw: unknown): TimelineMarker {
  if (!isRecord(raw) || typeof raw.time !== "number") {
    return { time: 0, name: "" };
  }
  return { time: raw.time, name: typeof raw.name === "string" ? raw.name : "" };
}

function normalizeVertexSkin(raw: unknown): VertexSkinData {
  if (!isRecord(raw) || typeof raw.vertexId !== "string") {
    throw new SchemaError("Skin vertex entry must have vertexId");
  }
  const influencesRaw = Array.isArray(raw.influences) ? raw.influences : [];
  return {
    vertexId: raw.vertexId as VertexId,
    influences: influencesRaw.map((item) => normalizeInfluence(item)),
  };
}

function normalizeInfluence(raw: unknown): SkinInfluence {
  if (!isRecord(raw) || typeof raw.boneId !== "string") {
    throw new SchemaError("Skin influence must have boneId");
  }
  return {
    boneId: raw.boneId as BoneId,
    weight: typeof raw.weight === "number" ? raw.weight : 0,
  };
}

function parseTransform(raw: unknown): TransformData {
  const fallback = identityTransform();
  if (!isRecord(raw)) {
    return fallback;
  }
  const position = isRecord(raw.position) ? raw.position : {};
  const rotation = isRecord(raw.rotation) ? raw.rotation : {};
  const scale = isRecord(raw.scale) ? raw.scale : {};
  return {
    position: {
      x: num(position.x, 0),
      y: num(position.y, 0),
      z: num(position.z, 0),
    },
    rotation: {
      x: num(rotation.x, 0),
      y: num(rotation.y, 0),
      z: num(rotation.z, 0),
      w: num(rotation.w, 1),
    },
    scale: {
      x: num(scale.x, 1),
      y: num(scale.y, 1),
      z: num(scale.z, 1),
    },
  };
}

function parseLoop(value: unknown): AnimationLoopMode {
  return value === "repeat" || value === "ping-pong" || value === "hold" || value === "once"
    ? value
    : "once";
}

function parseChannel(value: unknown): AnimationChannel {
  return value === "rotation" || value === "scale" || value === "visibility" || value === "position"
    ? value
    : "position";
}

function parseInterp(value: unknown): AnimationInterpolation {
  return value === "constant" || value === "cubic" || value === "linear" ? value : "linear";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { AnimationTargetKind };
