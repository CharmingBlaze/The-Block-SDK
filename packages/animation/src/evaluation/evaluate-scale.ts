import type { AnimationInterpolation, AnimationKeyframe } from "@modeling-kit/document";
import { Vector3 } from "@modeling-kit/math";
import { interpolateVector } from "./evaluate-position";

export function evaluateScale(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Vector3 {
  return interpolateVector(keys, time, interpolation);
}
