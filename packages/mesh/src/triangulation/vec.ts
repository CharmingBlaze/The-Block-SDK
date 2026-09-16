import type { Vec2, Vec3 } from "./types";

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vectorLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function distanceSquared(a: Vec3, b: Vec3): number {
  const d = sub(a, b);
  return d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
}

export function flattenXY(coords: readonly Vec2[]): number[] {
  const data: number[] = [];
  for (const point of coords) {
    data.push(point[0], point[1]);
  }
  return data;
}

export function orderTriple(a: number, b: number, c: number, reversed: boolean): [number, number, number] {
  return reversed ? [a, c, b] : [a, b, c];
}
