import type { AnimationInterpolation, AnimationKeyframe } from "@modeling-kit/document";
import { Quaternion } from "@modeling-kit/math";
import { findSpan } from "./time";

/**
 * Quaternion interpolation uses normalized slerp. Rotations are never lerped as ordinary vectors.
 * Canonical `cubic` rotation uses slerp between neighboring keys (Catmull-Rom is not defined on S³ here).
 */
export function interpolateRotation(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Quaternion {
  if (keys.length === 0) {
    return Quaternion.identity;
  }
  const { i0, i1, t } = findSpan(
    keys.map((key) => key.time),
    time,
  );
  const a = keys[i0]!.value;
  const qa = new Quaternion(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 1).normalize();
  if (interpolation === "constant" || i0 === i1 || keys.length < 2) {
    return qa;
  }
  const b = keys[i1]!.value;
  return qa.slerp(new Quaternion(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 1).normalize(), t);
}

export function evaluateRotation(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Quaternion {
  return interpolateRotation(keys, time, interpolation);
}
