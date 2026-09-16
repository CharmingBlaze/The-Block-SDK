import type { AnimationInterpolation, AnimationKeyframe } from "@modeling-kit/document";
import { findSpan } from "./time";

/** Numeric `cubic` is Catmull-Rom through authored keys, not glTF CUBICSPLINE tangents. */
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
  const { i0, i1, t } = findSpan(
    keys.map((key) => key.time),
    time,
  );
  const a = keys[i0]!;
  const b = keys[i1]!;
  const dim = a.value.length;
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

/** Hermite cubic for one component using glTF CUBICSPLINE in/out tangents. */
export function interpolateHermite(
  previous: number,
  previousOutTangent: number,
  next: number,
  nextInTangent: number,
  t: number,
  dt: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * previous + h10 * dt * previousOutTangent + h01 * next + h11 * dt * nextInTangent;
}
