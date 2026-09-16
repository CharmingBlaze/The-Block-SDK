import type { AnimationChannel, AnimationTargetKind } from "@modeling-kit/document";

const OBJECT_CHANNELS: readonly AnimationChannel[] = ["position", "rotation", "scale", "visibility"];
const BONE_CHANNELS: readonly AnimationChannel[] = ["position", "rotation", "scale"];

export function expectedComponentCount(channel: AnimationChannel): number {
  if (channel === "rotation") {
    return 4;
  }
  if (channel === "visibility") {
    return 1;
  }
  return 3;
}

export function isChannelAllowed(targetKind: AnimationTargetKind, channel: AnimationChannel): boolean {
  const allowed = targetKind === "bone" ? BONE_CHANNELS : OBJECT_CHANNELS;
  return allowed.includes(channel);
}

export function trackIdentityKey(
  targetKind: AnimationTargetKind,
  targetId: string,
  channel: AnimationChannel,
): string {
  return `${targetKind}:${targetId}:${channel}`;
}
