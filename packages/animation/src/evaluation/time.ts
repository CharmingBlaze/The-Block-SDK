import type { AnimationClipData } from "@modeling-kit/document";

export function wrapTime(
  time: number,
  duration: number,
  loopMode: AnimationClipData["loopMode"],
): number {
  if (duration <= 0) {
    return 0;
  }
  if (loopMode === "once" || loopMode === "hold") {
    return Math.min(duration, Math.max(0, time));
  }
  if (loopMode === "repeat") {
    const mod = time % duration;
    return mod < 0 ? mod + duration : mod;
  }
  const cycle = duration * 2;
  let t = time % cycle;
  if (t < 0) {
    t += cycle;
  }
  return t <= duration ? t : cycle - t;
}

export function findSpan(
  times: readonly number[],
  time: number,
): { i0: number; i1: number; t: number } {
  if (times.length === 0) {
    return { i0: 0, i1: 0, t: 0 };
  }
  if (time <= times[0]!) {
    return { i0: 0, i1: 0, t: 0 };
  }
  const last = times.length - 1;
  if (time >= times[last]!) {
    return { i0: last, i1: last, t: 0 };
  }
  for (let i = 0; i < last; i++) {
    const a = times[i]!;
    const b = times[i + 1]!;
    if (time >= a && time <= b) {
      const span = b - a;
      return { i0: i, i1: i + 1, t: span <= 1e-12 ? 0 : (time - a) / span };
    }
  }
  return { i0: last, i1: last, t: 0 };
}
