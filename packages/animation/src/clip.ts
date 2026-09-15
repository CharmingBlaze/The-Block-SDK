import type { AnimationId } from "@modeling-kit/core";
import { animationClipToDocumentClip, validateKeyframeTrack } from "./compat";
import { evaluateDocumentClip } from "./evaluate";
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
 * Samples a legacy clip through `evaluateDocumentClip` so interpolation matches
 * stored `AnimationClipData`.
 */
export function evaluateClip(clip: AnimationClip, time: number): Map<string, EvaluatedTransform> {
  const pose = evaluateDocumentClip(animationClipToDocumentClip(clip), time);
  const wanted = new Map<string, Set<"translation" | "rotation" | "scale">>();
  for (const track of clip.tracks) {
    const targetKey = String(track.targetId);
    let channels = wanted.get(targetKey);
    if (!channels) {
      channels = new Set();
      wanted.set(targetKey, channels);
    }
    channels.add(track.path === "translation" ? "translation" : track.path);
  }
  const result = new Map<string, EvaluatedTransform>();
  for (const [id, channels] of wanted) {
    const transform = pose.objectLocals.get(id);
    if (!transform) {
      continue;
    }
    const out: EvaluatedTransform = {};
    if (channels.has("translation")) {
      out.translation = [transform.position.x, transform.position.y, transform.position.z];
    }
    if (channels.has("rotation")) {
      out.rotation = [transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w];
    }
    if (channels.has("scale")) {
      out.scale = [transform.scale.x, transform.scale.y, transform.scale.z];
    }
    result.set(id, out);
  }
  return result;
}
