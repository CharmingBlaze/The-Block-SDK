import type { BoneId } from "@modeling-kit/core";
import type { AnimationClipData } from "@modeling-kit/document";
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
