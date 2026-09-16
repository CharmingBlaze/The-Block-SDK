import { interpolateRotation } from "../evaluation/evaluate-rotation";
import { interpolateNumbers } from "../evaluation/interpolation";
import { keyframeTrackToDocumentTrack } from "./gltf-track";
import type { KeyframeTrack } from "./legacy-types";

export { validateKeyframeTrack } from "./gltf-track";

export function findKeyframeIndex(times: readonly number[], t: number): number {
  if (times.length <= 1 || t <= times[0]!) return 0;
  if (t >= times[times.length - 1]!) return times.length - 2;

  let low = 0;
  let high = times.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (times[mid]! <= t && t < times[mid + 1]!) {
      return mid;
    }
    if (times[mid]! > t) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, low - 1);
}

export function sampleTrack(track: KeyframeTrack, time: number): number[] {
  const converted = keyframeTrackToDocumentTrack(track, "sample");
  if (track.path === "rotation") {
    const q = interpolateRotation(converted.keys, time, converted.interpolation);
    return [q.x, q.y, q.z, q.w];
  }
  return interpolateNumbers(converted.keys, time, converted.interpolation);
}
