import type { AnimationInterpolation, AnimationKeyframe } from "@modeling-kit/document";
import { interpolateNumbers } from "./interpolation";

export function evaluateVisibility(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): boolean {
  const value = interpolateNumbers(keys, time, interpolation)[0] ?? 1;
  return value >= 0.5;
}
