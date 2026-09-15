import type {
  AnimationClipData,
  AnimationInterpolation,
  AnimationKeyframe,
} from "@modeling-kit/document";
import { Quaternion, Vector3 } from "@modeling-kit/math";

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

function findSpan(
  keys: readonly AnimationKeyframe[],
  time: number,
): {
  i0: number;
  i1: number;
  t: number;
} {
  if (keys.length === 0) {
    return { i0: 0, i1: 0, t: 0 };
  }
  if (time <= keys[0]!.time) {
    return { i0: 0, i1: 0, t: 0 };
  }
  const last = keys.length - 1;
  if (time >= keys[last]!.time) {
    return { i0: last, i1: last, t: 0 };
  }
  for (let i = 0; i < last; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      return { i0: i, i1: i + 1, t: span <= 1e-12 ? 0 : (time - a.time) / span };
    }
  }
  return { i0: last, i1: last, t: 0 };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function interpolateNumbers(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): number[] {
  if (keys.length === 0) {
    return [];
  }
  const { i0, i1, t } = findSpan(keys, time);
  const a = keys[i0]!;
  const b = keys[i1]!;
  const dim = Math.max(a.value.length, b.value.length);
  const out: number[] = [];
  if (interpolation === "constant" || i0 === i1) {
    for (let i = 0; i < dim; i++) {
      out.push(a.value[i] ?? 0);
    }
    return out;
  }
  if (interpolation === "cubic" && keys.length >= 2) {
    const iPrev = Math.max(0, i0 - 1);
    const iNext = Math.min(keys.length - 1, i1 + 1);
    const p0 = keys[iPrev]!;
    const p3 = keys[iNext]!;
    for (let i = 0; i < dim; i++) {
      out.push(catmull(p0.value[i] ?? 0, a.value[i] ?? 0, b.value[i] ?? 0, p3.value[i] ?? 0, t));
    }
    return out;
  }
  for (let i = 0; i < dim; i++) {
    const av = a.value[i] ?? 0;
    const bv = b.value[i] ?? 0;
    out.push(av + (bv - av) * t);
  }
  return out;
}

export function interpolateRotation(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Quaternion {
  const numbers = interpolateNumbers(
    keys,
    time,
    interpolation === "cubic" ? "linear" : interpolation,
  );
  const qa = new Quaternion(numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1);
  if (interpolation === "constant" || keys.length < 2) {
    return qa.normalize();
  }
  const { i0, i1, t } = findSpan(keys, time);
  if (i0 === i1) {
    return qa.normalize();
  }
  const a = keys[i0]!.value;
  const b = keys[i1]!.value;
  return new Quaternion(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 1).slerp(
    new Quaternion(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 1),
    t,
  );
}

export function interpolateVector(
  keys: readonly AnimationKeyframe[],
  time: number,
  interpolation: AnimationInterpolation,
): Vector3 {
  const n = interpolateNumbers(keys, time, interpolation);
  return new Vector3(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0);
}
