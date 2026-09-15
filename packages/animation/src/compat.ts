import type { AnimationClipData, AnimationTrackData } from "@modeling-kit/document";
import type { AnimationClip, KeyframeTrack } from "./types";

const PATH_TO_CHANNEL = {
  translation: "position",
  rotation: "rotation",
  scale: "scale",
} as const;

export function validateKeyframeTrack(track: KeyframeTrack): void {
  const stride = track.path === "rotation" ? 4 : 3;
  if (track.times.length === 0) {
    return;
  }
  if (track.interpolation === "CUBICSPLINE") {
    throw new RangeError("CUBICSPLINE interpolation is not implemented; convert to document cubic keys or use LINEAR");
  }
  let previous = Number.NEGATIVE_INFINITY;
  for (const time of track.times) {
    if (!Number.isFinite(time)) {
      throw new RangeError("Keyframe times must be finite");
    }
    if (time < previous) {
      throw new RangeError("Keyframe times must be sorted in non-decreasing order");
    }
    if (time === previous) {
      throw new RangeError("Keyframe times must be unique");
    }
    previous = time;
  }
  const expected = track.times.length * stride;
  if (track.values.length < expected) {
    throw new RangeError(`Keyframe values length ${track.values.length} is shorter than ${expected}`);
  }
  for (let i = 0; i < expected; i += 1) {
    if (!Number.isFinite(track.values[i])) {
      throw new RangeError("Keyframe values must be finite");
    }
  }
}

/**
 * Compatibility boundary: glTF-shaped tracks become document tracks.
 * `CUBICSPLINE` is rejected here; canonical clips use `cubic` (Catmull-Rom).
 */
export function keyframeTrackToDocumentTrack(track: KeyframeTrack, id = "legacy"): AnimationTrackData {
  validateKeyframeTrack(track);
  const stride = track.path === "rotation" ? 4 : 3;
  const keys = track.times.map((time, index) => ({
    time,
    value: track.values.slice(index * stride, (index + 1) * stride),
  }));
  return {
    id,
    targetKind: "object",
    targetId: String(track.targetId),
    channel: PATH_TO_CHANNEL[track.path],
    interpolation: track.interpolation === "STEP" ? "constant" : "linear",
    keys,
  };
}

export function animationClipToDocumentClip(clip: AnimationClip): AnimationClipData {
  return {
    id: clip.id,
    name: clip.name,
    duration: clip.duration,
    loopMode: "once",
    tracks: clip.tracks.map((track, index) => keyframeTrackToDocumentTrack(track, `legacy-${index}`)),
    markers: [],
    metadata: { compatibility: "gltf-keyframe-track" },
  };
}
