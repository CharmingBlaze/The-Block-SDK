import { lerpVec3 } from "../../internal/attribute-interpolation";
import type { Vec3 } from "./types";

export function addVec(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
}

export function scaleVec(a: readonly number[], s: number): Vec3 {
  return [a[0]! * s, a[1]! * s, a[2]! * s];
}

export function averageVec(points: readonly (readonly number[])[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p[0]!;
    y += p[1]!;
    z += p[2]!;
  }
  const n = points.length || 1;
  return [x / n, y / n, z / n];
}

export function lerpPoint(
  a: readonly number[],
  b: readonly number[],
  t: number,
): Vec3 {
  return lerpVec3(
    [a[0]!, a[1]!, a[2]!],
    [b[0]!, b[1]!, b[2]!],
    t,
  );
}

export function clonePoint(p: readonly number[]): Vec3 {
  return [p[0]!, p[1]!, p[2]!];
}
