import { AnimationMixer, type AnimationClip, type Object3D } from "three";
import type { AnimationPlaybackHandle } from "./update-animation";

export function createThreeAnimationMixer(root: Object3D): AnimationMixer {
  return new AnimationMixer(root);
}

export function createAnimationPlayback(
  root: Object3D,
  clips: ReadonlyMap<string, AnimationClip>,
): AnimationPlaybackHandle {
  const mixer = createThreeAnimationMixer(root);
  const actions = new Map(
    [...clips.entries()].map(([id, clip]) => [id, mixer.clipAction(clip)] as const),
  );
  return { mixer, clips, actions, activeClipId: null };
}

