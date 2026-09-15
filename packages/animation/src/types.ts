import type { AnimationId, ObjectId } from "@modeling-kit/core";

export type AnimationPath = "translation" | "rotation" | "scale";

export type AnimationInterpolation = "STEP" | "LINEAR" | "CUBICSPLINE";

export interface KeyframeTrack {
  readonly targetId: ObjectId | string;
  readonly path: AnimationPath;
  readonly interpolation: AnimationInterpolation;
  readonly times: readonly number[];
  readonly values: readonly number[]; // 3 floats per key for translation/scale; 4 floats per key for rotation
}

export interface AnimationClip {
  readonly id: AnimationId;
  readonly name: string;
  readonly duration: number;
  readonly tracks: readonly KeyframeTrack[];
}
