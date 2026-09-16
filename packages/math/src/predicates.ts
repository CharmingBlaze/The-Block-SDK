/**
 * Robust orientation predicates for sign decisions.
 *
 * `robust-predicates` assumes a Y-down screen frame. This module negates those
 * results so they match the SDK: right-handed, Y-up, CCW-positive (the same
 * sign as a 2D cross product and a right-handed tetrahedron volume).
 *
 * Use these for left/right, above/below, winding, collinear, and coplanar
 * classification. Distance, snapping, weld, and user-facing thresholds still
 * belong to `GeometryTolerance` — see `docs/guides/geometry-predicates.md`.
 */

import {
  orient2d as libraryOrient2d,
  orient3d as libraryOrient3d,
} from "robust-predicates";

export type PredicateSign = -1 | 0 | 1;

export type PredicateVec2 = readonly [number, number];
export type PredicateVec3 = readonly [number, number, number];

function requireFinite(label: string, values: readonly number[]): void {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === undefined || !Number.isFinite(value)) {
      throw new RangeError(`${label} requires finite coordinates`);
    }
  }
}

export function predicateSign(value: number): PredicateSign {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * Twice the signed area of triangle `abc`. Positive if `abc` is
 * counter-clockwise in the XY plane (Y-up).
 */
export function orient2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  requireFinite("orient2d", [ax, ay, bx, by, cx, cy]);
  return -libraryOrient2d(ax, ay, bx, by, cx, cy);
}

/**
 * Six times the signed tetrahedron volume of `abcd`. Positive if `d` is on the
 * normal side of CCW triangle `abc` (right-handed).
 */
export function orient3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
): number {
  requireFinite("orient3d", [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz]);
  return -libraryOrient3d(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
}

export function orientation2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): PredicateSign {
  return predicateSign(orient2d(ax, ay, bx, by, cx, cy));
}

export function orientation3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
): PredicateSign {
  return predicateSign(orient3d(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz));
}

export function orient2dPoints(a: PredicateVec2, b: PredicateVec2, c: PredicateVec2): number {
  return orient2d(a[0], a[1], b[0], b[1], c[0], c[1]);
}

export function orient3dPoints(
  a: PredicateVec3,
  b: PredicateVec3,
  c: PredicateVec3,
  d: PredicateVec3,
): number {
  return orient3d(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
}

export function isCollinear2d(a: PredicateVec2, b: PredicateVec2, c: PredicateVec2): boolean {
  return orientation2d(a[0], a[1], b[0], b[1], c[0], c[1]) === 0;
}

/**
 * Three points are collinear when they are collinear in every coordinate plane.
 */
export function isCollinear3d(a: PredicateVec3, b: PredicateVec3, c: PredicateVec3): boolean {
  return (
    isCollinear2d([a[0], a[1]], [b[0], b[1]], [c[0], c[1]]) &&
    isCollinear2d([a[0], a[2]], [b[0], b[2]], [c[0], c[2]]) &&
    isCollinear2d([a[1], a[2]], [b[1], b[2]], [c[1], c[2]])
  );
}

export function isCoplanar(
  a: PredicateVec3,
  b: PredicateVec3,
  c: PredicateVec3,
  d: PredicateVec3,
): boolean {
  return orientation3d(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]) === 0;
}

/**
 * Planar turn `abc` relative to `normal`. Positive is a left (CCW) turn when
 * the face is viewed along the normal.
 */
export function planarTurnSign(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  nx: number,
  ny: number,
  nz: number,
): PredicateSign {
  return orientation3d(ax, ay, az, bx, by, bz, cx, cy, cz, bx + nx, by + ny, bz + nz);
}

/**
 * Drop a 3D point onto the dominant coordinate plane of `normal`, flipping a
 * axis when the normal points the opposite way so projected CCW matches 3D CCW.
 */
export function projectPointToOrientedPlane2d(
  nx: number,
  ny: number,
  nz: number,
  x: number,
  y: number,
  z: number,
): PredicateVec2 {
  requireFinite("projectPointToOrientedPlane2d", [nx, ny, nz, x, y, z]);
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ax >= ay && ax >= az) {
    return nx >= 0 ? [y, z] : [y, -z];
  }
  if (ay >= ax && ay >= az) {
    return ny >= 0 ? [z, x] : [z, -x];
  }
  return nz >= 0 ? [x, y] : [x, -y];
}

export function polygonTwiceSignedArea2d(ring: readonly PredicateVec2[]): number {
  if (ring.length < 3) {
    return 0;
  }
  const origin = ring[0]!;
  let twice = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    twice += orient2dPoints(origin, ring[i]!, ring[i + 1]!);
  }
  return twice;
}

export function polygonWinding2d(ring: readonly PredicateVec2[]): PredicateSign {
  return predicateSign(polygonTwiceSignedArea2d(ring));
}

/**
 * Proper 2D segment intersection: interiors cross. Shared endpoints and
 * collinear overlaps return false (those are tolerance/overlap problems).
 */
export function segmentsIntersectProper2d(
  a1: PredicateVec2,
  a2: PredicateVec2,
  b1: PredicateVec2,
  b2: PredicateVec2,
): boolean {
  const d1 = orient2dPoints(a1, a2, b1);
  const d2 = orient2dPoints(a1, a2, b2);
  const d3 = orient2dPoints(b1, b2, a1);
  const d4 = orient2dPoints(b1, b2, a2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Inclusive of the boundary. `abc` must already be CCW. */
export function pointInTriangleCCW2d(
  p: PredicateVec2,
  a: PredicateVec2,
  b: PredicateVec2,
  c: PredicateVec2,
): boolean {
  return (
    orient2dPoints(a, b, p) >= 0 && orient2dPoints(b, c, p) >= 0 && orient2dPoints(c, a, p) >= 0
  );
}

/**
 * Even-odd ray test using robust edge orientation. Preserves even-odd
 * semantics for self-overlapping rings.
 */
export function pointInPolygonEvenOdd2d(px: number, py: number, ring: readonly PredicateVec2[]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > py === b[1] > py) {
      continue;
    }
    const orientation = orient2d(a[0], a[1], b[0], b[1], px, py);
    if (orientation === 0) {
      continue;
    }
    if (orientation > 0 === b[1] > a[1]) {
      inside = !inside;
    }
  }
  return inside;
}

export interface GeometryPredicates {
  readonly orient2d: typeof orient2d;
  readonly orient3d: typeof orient3d;
  readonly orientation2d: typeof orientation2d;
  readonly orientation3d: typeof orientation3d;
  readonly isCollinear2d: typeof isCollinear2d;
  readonly isCollinear3d: typeof isCollinear3d;
  readonly isCoplanar: typeof isCoplanar;
  readonly planarTurnSign: typeof planarTurnSign;
  readonly projectPointToOrientedPlane2d: typeof projectPointToOrientedPlane2d;
  readonly polygonTwiceSignedArea2d: typeof polygonTwiceSignedArea2d;
  readonly polygonWinding2d: typeof polygonWinding2d;
  readonly segmentsIntersectProper2d: typeof segmentsIntersectProper2d;
  readonly pointInTriangleCCW2d: typeof pointInTriangleCCW2d;
  readonly pointInPolygonEvenOdd2d: typeof pointInPolygonEvenOdd2d;
}

export const defaultGeometryPredicates: GeometryPredicates = Object.freeze({
  orient2d,
  orient3d,
  orientation2d,
  orientation3d,
  isCollinear2d,
  isCollinear3d,
  isCoplanar,
  planarTurnSign,
  projectPointToOrientedPlane2d,
  polygonTwiceSignedArea2d,
  polygonWinding2d,
  segmentsIntersectProper2d,
  pointInTriangleCCW2d,
  pointInPolygonEvenOdd2d,
});
