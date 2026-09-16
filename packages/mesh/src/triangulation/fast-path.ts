import type { Vec3 } from "./types";

const AREA_EPS = 1e-20;
/** Cosine of about 2.5°. Grid quads are 1.0; this still rejects folded quads. */
const PLANAR_DOT = 0.999;

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function lengthSq(v: Vec3): number {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function triangleAreaSq(a: Vec3, b: Vec3, c: Vec3): number {
  return lengthSq(cross(sub(b, a), sub(c, a)));
}

/** Identity dump for a kernel triangle that was already validated at insert. */
export function identityTriangle(points: readonly Vec3[]): readonly (readonly [number, number, number])[] | null {
  if (points.length !== 3) {
    return null;
  }
  if (triangleAreaSq(points[0]!, points[1]!, points[2]!) <= AREA_EPS) {
    return null;
  }
  return [[0, 1, 2]];
}

/**
 * Blender-style fixed split `(0,1,2)+(0,2,3)` for a convex planar quad.
 * Concave or folded quads return null so Earcut/earclip can run.
 */
export function fixedQuadSplit(points: readonly Vec3[]): readonly (readonly [number, number, number])[] | null {
  if (points.length !== 4) {
    return null;
  }
  const a = points[0]!;
  const b = points[1]!;
  const c = points[2]!;
  const d = points[3]!;
  const n1 = cross(sub(b, a), sub(c, a));
  const n2 = cross(sub(c, a), sub(d, a));
  const l1 = lengthSq(n1);
  const l2 = lengthSq(n2);
  if (l1 <= AREA_EPS || l2 <= AREA_EPS) {
    return null;
  }
  const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
  if (dot <= 0) {
    return null;
  }
  const denom = Math.sqrt(l1 * l2);
  if (dot < PLANAR_DOT * denom) {
    return null;
  }
  return [
    [0, 1, 2],
    [0, 2, 3],
  ];
}

export function tessellateValidatedFace(
  points: readonly Vec3[],
): readonly (readonly [number, number, number])[] | null {
  return identityTriangle(points) ?? fixedQuadSplit(points);
}
