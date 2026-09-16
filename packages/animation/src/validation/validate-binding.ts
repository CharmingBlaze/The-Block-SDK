import type { AnimationTrackData } from "@modeling-kit/document";
import { isChannelAllowed } from "../model/binding";

export function validateBinding(track: Pick<AnimationTrackData, "targetKind" | "targetId" | "channel">): void {
  if (!track.targetId) {
    throw new RangeError("Animation binding targetId is required");
  }
  if (track.targetKind !== "bone" && track.targetKind !== "object") {
    throw new RangeError("Animation binding targetKind must be bone or object");
  }
  if (!isChannelAllowed(track.targetKind, track.channel)) {
    throw new RangeError(
      `Animation channel '${track.channel}' is not valid for ${track.targetKind} targets`,
    );
  }
}
