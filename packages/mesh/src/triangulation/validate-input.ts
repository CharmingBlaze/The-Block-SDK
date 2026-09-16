import { orient2dPoints, segmentsIntersectProper2d } from "@modeling-kit/math";
import { projectToLargestExtentPlane } from "./extent-project";
import type { Vec2, Vec3 } from "./types";

export function requireFiniteLoops(label: string, loops: readonly (readonly Vec3[])[]): void {
  for (const loop of loops) {
    for (const point of loop) {
      for (const value of point) {
        if (!Number.isFinite(value)) {
          throw new RangeError(`${label} requires finite coordinates`);
        }
      }
    }
  }
}

export function polygonSelfIntersects(coords: readonly Vec2[]): boolean {
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const a1 = coords[i]!;
    const a2 = coords[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1) || (j === 0 && i === n - 1)) {
        continue;
      }
      const b1 = coords[j]!;
      const b2 = coords[(j + 1) % n]!;
      if (segmentsIntersectProper2d(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

export function polygonSelfIntersects3d(points: readonly Vec3[]): boolean {
  return polygonSelfIntersects(projectToLargestExtentPlane(points));
}

export function isConvexCCW(coords: readonly Vec2[]): boolean {
  if (coords.length < 3) {
    return false;
  }
  for (let i = 0; i < coords.length; i++) {
    const a = coords[(i - 1 + coords.length) % coords.length]!;
    const b = coords[i]!;
    const c = coords[(i + 1) % coords.length]!;
    if (orient2dPoints(a, b, c) <= 0) {
      return false;
    }
  }
  return true;
}
