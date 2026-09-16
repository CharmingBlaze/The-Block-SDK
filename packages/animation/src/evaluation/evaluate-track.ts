import type { AnimationKeyframe, AnimationTrackData } from "@modeling-kit/document";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import { evaluatePosition } from "./evaluate-position";
import { evaluateRotation } from "./evaluate-rotation";
import { evaluateScale } from "./evaluate-scale";
import { evaluateVisibility } from "./evaluate-visibility";

export function evaluateTrackValue(track: AnimationTrackData, time: number): readonly number[] {
  if (track.keys.length === 0) {
    return [];
  }
  if (track.channel === "visibility") {
    return [evaluateVisibility(track.keys, time, track.interpolation) ? 1 : 0];
  }
  if (track.channel === "rotation") {
    const q = evaluateRotation(track.keys, time, track.interpolation);
    return [q.x, q.y, q.z, q.w];
  }
  if (track.channel === "scale") {
    const v = evaluateScale(track.keys, time, track.interpolation);
    return [v.x, v.y, v.z];
  }
  const v = evaluatePosition(track.keys, time, track.interpolation);
  return [v.x, v.y, v.z];
}

export function applyChannel(
  current: TransformData,
  channel: AnimationTrackData["channel"],
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationTrackData["interpolation"],
): TransformData {
  if (channel === "position") {
    return { ...current, position: evaluatePosition(keys, time, interpolation).toJSON() };
  }
  if (channel === "scale") {
    return { ...current, scale: evaluateScale(keys, time, interpolation).toJSON() };
  }
  if (channel === "rotation") {
    return { ...current, rotation: evaluateRotation(keys, time, interpolation).toJSON() };
  }
  return current;
}

export function identityTargetTransform(): TransformData {
  return identityTransform();
}
