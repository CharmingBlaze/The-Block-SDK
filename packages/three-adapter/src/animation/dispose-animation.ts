import type { AnimationPlaybackHandle } from "./update-animation";

export function disposeThreeAnimation(handle: AnimationPlaybackHandle): void {
  handle.mixer.stopAllAction();
  for (const action of handle.actions.values()) {
    handle.mixer.uncacheAction(action.getClip());
  }
  handle.actions.clear();
  handle.clips.forEach((clip) => {
    handle.mixer.uncacheClip(clip);
  });
  handle.activeClipId = null;
}
