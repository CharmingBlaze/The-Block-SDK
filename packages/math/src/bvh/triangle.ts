import { BoundingBox } from "../bbox";
import type { Ray } from "../ray";
import type { Vec3 } from "../vec3";

const DEFAULT_EPSILON = 1e-8;

/**
 * Möller–Trumbore ray/triangle test. Returns the smallest non-negative hit
 * distance, or null. Backfaces still hit; callers that want front-facing
 * only should reject by normal.
 */
export function rayIntersectTriangle(
  ray: Ray,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  epsilon = DEFAULT_EPSILON,
): number | null {
  const edge1x = b.x - a.x;
  const edge1y = b.y - a.y;
  const edge1z = b.z - a.z;
  const edge2x = c.x - a.x;
  const edge2y = c.y - a.y;
  const edge2z = c.z - a.z;

  const dir = ray.direction;
  const px = dir.y * edge2z - dir.z * edge2y;
  const py = dir.z * edge2x - dir.x * edge2z;
  const pz = dir.x * edge2y - dir.y * edge2x;
  const det = edge1x * px + edge1y * py + edge1z * pz;
  if (det > -epsilon && det < epsilon) {
    return null;
  }
  const invDet = 1 / det;
  const ox = ray.origin.x - a.x;
  const oy = ray.origin.y - a.y;
  const oz = ray.origin.z - a.z;
  const u = (ox * px + oy * py + oz * pz) * invDet;
  if (u < 0 || u > 1) {
    return null;
  }
  const qx = oy * edge1z - oz * edge1y;
  const qy = oz * edge1x - ox * edge1z;
  const qz = ox * edge1y - oy * edge1x;
  const v = (dir.x * qx + dir.y * qy + dir.z * qz) * invDet;
  if (v < 0 || u + v > 1) {
    return null;
  }
  const t = (edge2x * qx + edge2y * qy + edge2z * qz) * invDet;
  if (t < epsilon) {
    return null;
  }
  return t;
}

export function triangleBounds(a: Vec3, b: Vec3, c: Vec3): BoundingBox {
  return BoundingBox.fromMinMax(
    {
      x: Math.min(a.x, b.x, c.x),
      y: Math.min(a.y, b.y, c.y),
      z: Math.min(a.z, b.z, c.z),
    },
    {
      x: Math.max(a.x, b.x, c.x),
      y: Math.max(a.y, b.y, c.y),
      z: Math.max(a.z, b.z, c.z),
    },
  );
}

export function triangleBoundsFromPositions(
  positions: ArrayLike<number>,
  i0: number,
  i1: number,
  i2: number,
): BoundingBox {
  const ax = positions[i0 * 3]!;
  const ay = positions[i0 * 3 + 1]!;
  const az = positions[i0 * 3 + 2]!;
  const bx = positions[i1 * 3]!;
  const by = positions[i1 * 3 + 1]!;
  const bz = positions[i1 * 3 + 2]!;
  const cx = positions[i2 * 3]!;
  const cy = positions[i2 * 3 + 1]!;
  const cz = positions[i2 * 3 + 2]!;
  return BoundingBox.fromMinMax(
    { x: Math.min(ax, bx, cx), y: Math.min(ay, by, cy), z: Math.min(az, bz, cz) },
    { x: Math.max(ax, bx, cx), y: Math.max(ay, by, cy), z: Math.max(az, bz, cz) },
  );
}

export function rayIntersectIndexedTriangle(
  ray: Ray,
  positions: ArrayLike<number>,
  i0: number,
  i1: number,
  i2: number,
  epsilon = DEFAULT_EPSILON,
): number | null {
  return rayIntersectTriangle(
    ray,
    { x: positions[i0 * 3]!, y: positions[i0 * 3 + 1]!, z: positions[i0 * 3 + 2]! },
    { x: positions[i1 * 3]!, y: positions[i1 * 3 + 1]!, z: positions[i1 * 3 + 2]! },
    { x: positions[i2 * 3]!, y: positions[i2 * 3 + 1]!, z: positions[i2 * 3 + 2]! },
    epsilon,
  );
}
