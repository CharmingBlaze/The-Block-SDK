import type { Vec2, Vec3 } from "./types";

/** Bounding-box area of a 2D ring. Bowties have ~0 signed area, so do not use that here. */
export function axisAlignedExtentArea(coords: readonly Vec2[]): number {
  if (coords.length === 0) {
    return 0;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) {
      minX = x;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 0;
  }
  return width * height;
}

/**
 * Drop the axis with the smallest span. This still sees an XZ bowtie whose
 * Newell normal is nearly ±Z because of a small out-of-plane bump.
 */
export function projectToLargestExtentPlane(points: readonly Vec3[]): Vec2[] {
  const xy: Vec2[] = points.map((p) => [p[0], p[1]]);
  const xz: Vec2[] = points.map((p) => [p[0], p[2]]);
  const yz: Vec2[] = points.map((p) => [p[1], p[2]]);
  const areaXY = axisAlignedExtentArea(xy);
  const areaXZ = axisAlignedExtentArea(xz);
  const areaYZ = axisAlignedExtentArea(yz);
  if (areaXY >= areaXZ && areaXY >= areaYZ) {
    return xy;
  }
  if (areaXZ >= areaYZ) {
    return xz;
  }
  return yz;
}
