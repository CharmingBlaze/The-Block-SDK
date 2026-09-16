import type { AnimationKeyframe } from "@modeling-kit/document";

export function keyframe(time: number, value: readonly number[]): AnimationKeyframe {
  return { time, value };
}
