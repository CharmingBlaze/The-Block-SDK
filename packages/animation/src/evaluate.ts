import type { BoneId } from "@modeling-kit/core";
import type { AnimationClipData, AnimationTrackData } from "@modeling-kit/document";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type { PoseMap, Skeleton } from "@modeling-kit/rigging";
import {
  interpolateNumbers,
  interpolateRotation,
  interpolateVector,
  wrapTime,
} from "./interpolate";

export interface EvaluatedPose {
  readonly time: number;
  readonly boneLocals: PoseMap;
  readonly objectLocals: ReadonlyMap<string, TransformData>;
  readonly visibility: ReadonlyMap<string, boolean>;
}

export function evaluateDocumentClip(
  clip: AnimationClipData,
  time: number,
  skeleton?: Skeleton,
): EvaluatedPose {
  validateDocumentClip(clip);
  const wrapped = wrapTime(time, clip.duration, clip.loopMode);
  const boneLocals = new Map<BoneId, TransformData>();
  if (skeleton) {
    for (const bone of skeleton.bones.values()) {
      boneLocals.set(bone.id, bone.restTransform);
    }
  }
  const objectLocals = new Map<string, TransformData>();
  const visibility = new Map<string, boolean>();

  const ensureBone = (id: BoneId): TransformData => {
    const existing = boneLocals.get(id);
    if (existing) {
      return existing;
    }
    const created = identityTransform();
    boneLocals.set(id, created);
    return created;
  };

  for (const track of clip.tracks) {
    if (track.keys.length === 0) {
      continue;
    }
    if (track.channel === "visibility") {
      const value = interpolateNumbers(track.keys, wrapped, track.interpolation)[0] ?? 1;
      visibility.set(track.targetId, value >= 0.5);
      continue;
    }
    if (track.targetKind === "bone") {
      const current = ensureBone(track.targetId as BoneId);
      boneLocals.set(
        track.targetId as BoneId,
        applyChannel(current, track.channel, track.keys, wrapped, track.interpolation),
      );
      continue;
    }
    const current = objectLocals.get(track.targetId) ?? identityTransform();
    objectLocals.set(
      track.targetId,
      applyChannel(current, track.channel, track.keys, wrapped, track.interpolation),
    );
  }
  return { time: wrapped, boneLocals, objectLocals, visibility };
}

function applyChannel(
  current: TransformData,
  channel: "position" | "rotation" | "scale" | "visibility",
  keys: AnimationClipData["tracks"][number]["keys"],
  time: number,
  interpolation: AnimationClipData["tracks"][number]["interpolation"],
): TransformData {
  if (channel === "position") {
    const v = interpolateVector(keys, time, interpolation);
    return { ...current, position: v.toJSON() };
  }
  if (channel === "scale") {
    const v = interpolateVector(keys, time, interpolation);
    return { ...current, scale: v.toJSON() };
  }
  if (channel === "rotation") {
    return { ...current, rotation: interpolateRotation(keys, time, interpolation).toJSON() };
  }
  return current;
}

export function validateDocumentClip(clip: AnimationClipData): void {
  if (!Number.isFinite(clip.duration) || clip.duration < 0) {
    throw new RangeError("Animation clip duration must be a finite non-negative number");
  }
  const seen = new Set<string>();
  for (const track of clip.tracks) {
    const key = `${track.targetKind}:${track.targetId}:${track.channel}`;
    if (seen.has(key)) {
      throw new RangeError(`Duplicate animation track for ${key}`);
    }
    seen.add(key);
    validateDocumentTrack(track);
  }
}

function validateDocumentTrack(track: AnimationTrackData): void {
  let previous = Number.NEGATIVE_INFINITY;
  for (const key of track.keys) {
    if (!Number.isFinite(key.time)) {
      throw new RangeError("Animation key times must be finite");
    }
    if (key.time < previous) {
      throw new RangeError("Animation key times must be sorted in non-decreasing order");
    }
    if (key.time === previous) {
      throw new RangeError("Animation key times must be unique");
    }
    previous = key.time;
    const expected =
      track.channel === "rotation" ? 4 : track.channel === "visibility" ? 1 : 3;
    if (key.value.length < expected) {
      throw new RangeError(
        `Animation key at t=${key.time} needs ${expected} components for ${track.channel}`,
      );
    }
    for (const component of key.value) {
      if (!Number.isFinite(component)) {
        throw new RangeError("Animation key values must be finite");
      }
    }
  }
}
