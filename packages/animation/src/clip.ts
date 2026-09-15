import type { AnimationId } from "@modeling-kit/core";
import { sampleTrack, validateKeyframeTrack } from "./sampler";
import type { AnimationClip, KeyframeTrack } from "./types";

export interface EvaluatedTransform {
  translation?: [x: number, y: number, z: number] | undefined;
  rotation?: [x: number, y: number, z: number, w: number] | undefined;
  scale?: [x: number, y: number, z: number] | undefined;
}

export class AnimationClipBuilder {
  private tracks: KeyframeTrack[] = [];
  private duration = 0;

  constructor(
    readonly id: AnimationId,
    readonly name = "Clip",
  ) {}

  addTrack(track: KeyframeTrack): this {
    validateKeyframeTrack(track);
    this.tracks.push(track);
    const lastTime = track.times[track.times.length - 1] ?? 0;
    if (lastTime > this.duration) {
      this.duration = lastTime;
    }
    return this;
  }

  setDuration(duration: number): this {
    this.duration = duration;
    return this;
  }

  build(): AnimationClip {
    return {
      id: this.id,
      name: this.name,
      duration: this.duration,
      tracks: [...this.tracks],
    };
  }
}

/**
 * Samples an entire AnimationClip at timestamp t, returning the evaluated transforms for all affected targets.
 */
export function evaluateClip(clip: AnimationClip, time: number): Map<string, EvaluatedTransform> {
  const result = new Map<string, EvaluatedTransform>();

  for (const track of clip.tracks) {
    const targetKey = String(track.targetId);
    let transform = result.get(targetKey);
    if (!transform) {
      transform = {};
      result.set(targetKey, transform);
    }

    const val = sampleTrack(track, time);
    if (track.path === "translation") {
      transform.translation = [val[0]!, val[1]!, val[2]!];
    } else if (track.path === "rotation") {
      transform.rotation = [val[0]!, val[1]!, val[2]!, val[3]!];
    } else if (track.path === "scale") {
      transform.scale = [val[0]!, val[1]!, val[2]!];
    }
  }

  return result;
}
