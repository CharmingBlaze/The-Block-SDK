import { projectPointToOrientedPlane2d } from "@modeling-kit/math";
import type { Vec2, Vec3 } from "./types";
import { dot, scale, sub, vectorLength } from "./vec";

export function polygonNormal(points: readonly Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    nx += (current[1] - next[1]) * (current[2] + next[2]);
    ny += (current[2] - next[2]) * (current[0] + next[0]);
    nz += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return [nx, ny, nz];
}

export function polygonArea(points: readonly Vec3[]): number {
  return vectorLength(polygonNormal(points)) * 0.5;
}

export function unitNormalOrNull(points: readonly Vec3[], epsilon: number): Vec3 | null {
  const normal = polygonNormal(points);
  const length = vectorLength(normal);
  if (length <= epsilon) {
    return null;
  }
  return scale(normal, 1 / length);
}

export function projectPolygon(points: readonly Vec3[], normal: Vec3): Vec2[] {
  return points.map((p) => projectPointToOrientedPlane2d(normal[0], normal[1], normal[2], p[0], p[1], p[2]));
}

export function maxPlaneDeviation(points: readonly Vec3[], origin: Vec3, unit: Vec3): number {
  let max = 0;
  for (const p of points) {
    const d = Math.abs(dot(sub(p, origin), unit));
    if (d > max) {
      max = d;
    }
  }
  return max;
}

export function flipY(coords: readonly Vec2[]): Vec2[] {
  return coords.map(([x, y]) => [x, -y]);
}
