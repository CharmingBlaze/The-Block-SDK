import type { AnimationTrackData } from "@modeling-kit/document";
import { expectedComponentCount, isChannelAllowed } from "../model/binding";

export function validateTrack(track: AnimationTrackData): void {
  if (!track.targetId) {
    throw new RangeError("Animation track targetId is required");
  }
  if (!isChannelAllowed(track.targetKind, track.channel)) {
    throw new RangeError(
      `Animation channel '${track.channel}' is not valid for ${track.targetKind} targets`,
    );
  }
  const interpolation = track.interpolation;
  if (interpolation !== "constant" && interpolation !== "linear" && interpolation !== "cubic") {
    throw new RangeError(`Invalid animation interpolation '${String(interpolation)}'`);
  }
  let previous = Number.NEGATIVE_INFINITY;
  const expected = expectedComponentCount(track.channel);
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
    if (key.value.length !== expected) {
      throw new RangeError(
        `Animation key at t=${key.time} needs exactly ${expected} components for ${track.channel}`,
      );
    }
    for (const component of key.value) {
      if (!Number.isFinite(component)) {
        throw new RangeError("Animation key values must be finite");
      }
    }
    if (track.channel === "rotation") {
      const lenSq =
        (key.value[0] ?? 0) ** 2 +
        (key.value[1] ?? 0) ** 2 +
        (key.value[2] ?? 0) ** 2 +
        (key.value[3] ?? 0) ** 2;
      if (lenSq < 1e-12) {
        throw new RangeError(`Animation rotation key at t=${key.time} has zero length`);
      }
    }
  }
}
