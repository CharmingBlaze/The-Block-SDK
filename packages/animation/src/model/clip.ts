import type { AnimationId } from "@modeling-kit/core";
import { createAnimationClipData, type AnimationClipData, type AnimationTrackData } from "@modeling-kit/document";
import { validateTrack } from "../validation/validate-track";
import { validateClip } from "../validation/validate-clip";

export class CanonicalClipBuilder {
  private tracks: AnimationTrackData[] = [];
  private duration = 0;

  constructor(
    readonly id: AnimationId,
    readonly name = "Clip",
  ) {}

  addTrack(track: AnimationTrackData): this {
    validateTrack(track);
    this.tracks.push(track);
    const lastTime = track.keys[track.keys.length - 1]?.time ?? 0;
    if (lastTime > this.duration) {
      this.duration = lastTime;
    }
    return this;
  }

  setDuration(duration: number): this {
    this.duration = duration;
    return this;
  }

  build(): AnimationClipData {
    const clip = createAnimationClipData(this.id, this.name, {
      duration: this.duration,
      tracks: [...this.tracks],
    });
    validateClip(clip);
    return clip;
  }
}
