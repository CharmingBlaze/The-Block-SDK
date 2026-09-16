import type { AnimationClipData } from "@modeling-kit/document";
import { trackIdentityKey } from "../model/binding";
import { validateTrack } from "./validate-track";

export function validateClip(clip: AnimationClipData): void {
  if (!Number.isFinite(clip.duration) || clip.duration < 0) {
    throw new RangeError("Animation clip duration must be a finite non-negative number");
  }
  const seen = new Set<string>();
  for (const track of clip.tracks) {
    const key = trackIdentityKey(track.targetKind, track.targetId, track.channel);
    if (seen.has(key)) {
      throw new RangeError(`Duplicate animation track for ${key}`);
    }
    seen.add(key);
    validateTrack(track);
  }
}

export { validateClip as validateDocumentClip };
