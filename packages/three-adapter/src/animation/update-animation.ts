import type { AnimationClipData } from "@modeling-kit/document";
import {
  AnimationAction,
  AnimationMixer,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  type AnimationClip,
} from "three";

export interface AnimationPlaybackHandle {
  readonly mixer: AnimationMixer;
  readonly clips: ReadonlyMap<string, AnimationClip>;
  readonly actions: Map<string, AnimationAction>;
  activeClipId: string | null;
}

export function playThreeClip(
  handle: AnimationPlaybackHandle,
  clipId: string,
  loopMode: AnimationClipData["loopMode"] = "repeat",
): AnimationAction | undefined {
  const action = handle.actions.get(clipId);
  if (!action) {
    return undefined;
  }
  if (handle.activeClipId && handle.activeClipId !== clipId) {
    handle.actions.get(handle.activeClipId)?.stop();
  }
  action.reset();
  action.setLoop(
    loopMode === "once" || loopMode === "hold" ? LoopOnce : loopMode === "ping-pong" ? LoopPingPong : LoopRepeat,
    loopMode === "once" || loopMode === "hold" ? 1 : Infinity,
  );
  action.clampWhenFinished = loopMode === "hold" || loopMode === "once";
  action.play();
  handle.activeClipId = clipId;
  return action;
}

export function updateThreeAnimation(handle: AnimationPlaybackHandle, deltaSeconds: number): void {
  handle.mixer.update(deltaSeconds);
}
