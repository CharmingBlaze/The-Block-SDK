import type { AnimationClipData } from "@modeling-kit/document";
import { wrapTime } from "./interpolate";

export class AnimationPlayer {
  time = 0;
  playing = false;
  speed = 1;

  constructor(public clip: AnimationClipData) {}

  play(): void {
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.playing = false;
    this.time = 0;
  }

  scrub(time: number): void {
    this.time = wrapTime(time, this.clip.duration, this.clip.loopMode);
  }

  tick(deltaSeconds: number): number {
    if (this.playing) {
      this.time = wrapTime(
        this.time + deltaSeconds * this.speed,
        this.clip.duration,
        this.clip.loopMode,
      );
      if (this.clip.loopMode === "once" && this.time >= this.clip.duration) {
        this.playing = false;
      }
    }
    return this.time;
  }
}

export function reverseClip(clip: AnimationClipData): AnimationClipData {
  const duration = clip.duration;
  return {
    ...clip,
    tracks: clip.tracks.map((track) => ({
      ...track,
      keys: [...track.keys]
        .map((key) => ({ ...key, time: duration - key.time }))
        .sort((a, b) => a.time - b.time),
    })),
  };
}

export function scaleClipTime(clip: AnimationClipData, scale: number): AnimationClipData {
  const s = scale <= 0 ? 1 : scale;
  return {
    ...clip,
    duration: clip.duration * s,
    tracks: clip.tracks.map((track) => ({
      ...track,
      keys: track.keys.map((key) => ({ ...key, time: key.time * s })),
    })),
    markers: clip.markers.map((marker) => ({ ...marker, time: marker.time * s })),
  };
}
