import type { AnimationClipData } from "@modeling-kit/document";

export type LoopPolicy = AnimationClipData["loopMode"];

export function isLooping(loopMode: LoopPolicy): boolean {
  return loopMode === "repeat" || loopMode === "ping-pong";
}
