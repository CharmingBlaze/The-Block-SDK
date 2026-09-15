import { Quaternion, Vector3 } from "@modeling-kit/math";
import type { KeyframeTrack } from "./types";

export function validateKeyframeTrack(track: KeyframeTrack): void {
  const stride = track.path === "rotation" ? 4 : 3;
  if (track.times.length === 0) {
    return;
  }
  if (track.interpolation === "CUBICSPLINE") {
    throw new RangeError("CUBICSPLINE interpolation is not implemented");
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
 * Finds the lower keyframe index for timestamp t using binary search.
 */
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

/**
 * Evaluates a keyframe track at time t.
 * Returns a 3-element vector [x, y, z] for translation/scale, or a 4-element quaternion [x, y, z, w] for rotation.
 */
export function sampleTrack(track: KeyframeTrack, time: number): number[] {
  validateKeyframeTrack(track);
  const { times, values, interpolation, path } = track;
  const stride = path === "rotation" ? 4 : 3;

  if (times.length === 0) {
    return path === "rotation" ? [0, 0, 0, 1] : [0, 0, 0];
  }

  // Clamping
  if (time <= times[0]!) {
    return values.slice(0, stride);
  }
  if (time >= times[times.length - 1]!) {
    return values.slice((times.length - 1) * stride, times.length * stride);
  }

  const idx = findKeyframeIndex(times, time);
  const t0 = times[idx]!;
  const t1 = times[idx + 1]!;
  const alpha = (time - t0) / Math.max(1e-8, t1 - t0);

  if (interpolation === "STEP") {
    return values.slice(idx * stride, (idx + 1) * stride);
  }

  // LINEAR
  if (path === "rotation") {
    const q0 = new Quaternion(
      values[idx * 4]!,
      values[idx * 4 + 1]!,
      values[idx * 4 + 2]!,
      values[idx * 4 + 3]!,
    );
    const q1 = new Quaternion(
      values[(idx + 1) * 4]!,
      values[(idx + 1) * 4 + 1]!,
      values[(idx + 1) * 4 + 2]!,
      values[(idx + 1) * 4 + 3]!,
    );
    // Slerp
    const slerped = q0.slerp(q1, alpha);
    return [slerped.x, slerped.y, slerped.z, slerped.w];
  }

  // Vector3 linear interpolation
  const p0 = new Vector3(values[idx * 3]!, values[idx * 3 + 1]!, values[idx * 3 + 2]!);
  const p1 = new Vector3(
    values[(idx + 1) * 3]!,
    values[(idx + 1) * 3 + 1]!,
    values[(idx + 1) * 3 + 2]!,
  );

  const lerped = p0.lerp(p1, alpha);
  return [lerped.x, lerped.y, lerped.z];
}
