import type { AnimationInterpolation, AnimationKeyframe } from "@modeling-kit/document";
import { Vector3 } from "@modeling-kit/math";
import { interpolateNumbers } from "./interpolation";

export function interpolateVector(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Vector3 {
  const n = interpolateNumbers(keys, time, interpolation);
  return new Vector3(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0);
}

export function evaluatePosition(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Vector3 {
  return interpolateVector(keys, time, interpolation);
}
