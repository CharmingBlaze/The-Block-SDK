import type { AnimationId, ObjectId } from "@modeling-kit/core";

/**
 * Legacy glTF-shaped clip accepted only at import/compat boundaries.
 * Canonical stored and evaluated animation is `AnimationClipData`.
 */
export type AnimationPath = "translation" | "rotation" | "scale";

/** @deprecated Use document `AnimationInterpolation`. CUBICSPLINE is rejected unless repaired. */
export type AnimationInterpolation = "STEP" | "LINEAR" | "CUBICSPLINE";

export interface KeyframeTrack {
  readonly targetId: ObjectId | string;
  readonly path: AnimationPath;
  readonly interpolation: AnimationInterpolation;
  readonly times: readonly number[];
  readonly values: readonly number[];
}

export interface AnimationClip {
  readonly id: AnimationId;
  readonly name: string;
  readonly duration: number;
  readonly tracks: readonly KeyframeTrack[];
}
