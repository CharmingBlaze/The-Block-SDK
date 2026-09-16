/**
 * Deterministic ear-clipping triangulation for simple polygons.
 * Projects onto the dominant coordinate plane, then clips ears in original-index order.
 *
 * Orientation signs (winding, convex ears, proper intersections, exact collinearity)
 * use `@modeling-kit/math` GeometryPredicates. Near-duplicate collapse and
 * near-collinear cleanup still use `epsilon` from GeometryTolerance.
 */

import {
  isCollinear3d,
  orient2dPoints,
  pointInTriangleCCW2d,
  polygonTwiceSignedArea2d,
  projectPointToOrientedPlane2d,
  segmentsIntersectProper2d,
} from "@modeling-kit/math";

export type PolygonTriangulationStatus = "ok" | "degenerate" | "self-intersecting";

export interface PolygonTriangulationOptions {
  readonly epsilon?: number;
  readonly rejectSelfIntersecting?: boolean;
}

export interface PolygonTriangulation {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly status: PolygonTriangulationStatus;
  readonly nonPlanar: boolean;
  readonly reversed: boolean;
}

type Vec2 = readonly [number, number];
type Vec3 = readonly [number, number, number];

export function triangulatePolygon(
  points: readonly Vec3[],
  options: PolygonTriangulationOptions = {},
): PolygonTriangulation {
  const epsilon = options.epsilon ?? 1e-10;
  const rejectSelfIntersecting = options.rejectSelfIntersecting ?? true;
  if (points.length < 3) {
    return { triangles: [], status: "degenerate", nonPlanar: false, reversed: false };
  }

  const cleaned = collapseNearlyDuplicateAndCollinear(points, epsilon);
  if (cleaned.indices.length < 3) {
    return { triangles: [], status: "degenerate", nonPlanar: false, reversed: false };
  }

  const normal = polygonNormal(cleaned.points);
  const area = vectorLength(normal);
  if (area <= epsilon) {
    return { triangles: [], status: "degenerate", nonPlanar: false, reversed: false };
  }

  const unit = scale(normal, 1 / area);
  const nonPlanar = maxPlaneDeviation(cleaned.points, cleaned.points[0]!, unit) > Math.max(epsilon * 10, 1e-6);
  const projected = projectPolygon(cleaned.points, unit);
  const winding = polygonTwiceSignedArea2d(projected);
  const reversed = winding < 0;
  const coords = reversed ? projected.map(([x, y]) => [x, -y] as Vec2) : projected;

  if (polygonSelfIntersects(coords)) {
    if (rejectSelfIntersecting) {
      return { triangles: [], status: "self-intersecting", nonPlanar, reversed };
    }
  }

  const n = coords.length;
  if (n === 3) {
    return {
      triangles: [orderTriple(cleaned.indices[0]!, cleaned.indices[1]!, cleaned.indices[2]!, reversed)],
      status: "ok",
      nonPlanar,
      reversed,
    };
  }

  const rest = cleaned.indices.map((_, i) => i);
  const triangles: [number, number, number][] = [];
  let guard = 0;
  const maxSteps = rest.length * rest.length + 8;

  while (rest.length > 3 && guard < maxSteps) {
    guard += 1;
    const ear = findEar(rest, coords);
    if (ear < 0) {
      return { triangles, status: "self-intersecting", nonPlanar, reversed };
    }
    const prev = rest[(ear - 1 + rest.length) % rest.length]!;
    const curr = rest[ear]!;
    const next = rest[(ear + 1) % rest.length]!;
    triangles.push(orderTriple(cleaned.indices[prev]!, cleaned.indices[curr]!, cleaned.indices[next]!, reversed));
    rest.splice(ear, 1);
  }

  if (rest.length === 3) {
    triangles.push(
      orderTriple(
        cleaned.indices[rest[0]!]!,
        cleaned.indices[rest[1]!]!,
        cleaned.indices[rest[2]!]!,
        reversed,
      ),
    );
    return { triangles, status: "ok", nonPlanar, reversed };
  }

  return { triangles, status: "degenerate", nonPlanar, reversed };
}

function collapseNearlyDuplicateAndCollinear(
  points: readonly Vec3[],
  epsilon: number,
): { points: Vec3[]; indices: number[] } {
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const prevIdx = indices.length === 0 ? points.length - 1 : indices[indices.length - 1]!;
    if (distanceSquared(points[i]!, points[prevIdx]!) <= epsilon * epsilon) {
      continue;
    }
    indices.push(i);
  }
  if (indices.length >= 2 && distanceSquared(points[indices[0]!]!, points[indices[indices.length - 1]!]!) <= epsilon * epsilon) {
    indices.pop();
  }

  let changed = true;
  while (changed && indices.length > 3) {
    changed = false;
    for (let i = 0; i < indices.length; i++) {
      const prev = points[indices[(i - 1 + indices.length) % indices.length]!]!;
      const curr = points[indices[i]!]!;
      const next = points[indices[(i + 1) % indices.length]!]!;
      const ab = sub(curr, prev);
      const bc = sub(next, curr);
      const crossLen = vectorLength(cross(ab, bc));
      const denom = vectorLength(ab) * vectorLength(bc);
      const nearlyCollinear = denom > epsilon && crossLen <= epsilon * denom;
      if (nearlyCollinear || isCollinear3d(prev, curr, next)) {
        indices.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return { points: indices.map((i) => points[i]!), indices };
}

function findEar(rest: readonly number[], coords: readonly Vec2[]): number {
  for (let i = 0; i < rest.length; i++) {
    const prev = rest[(i - 1 + rest.length) % rest.length]!;
    const curr = rest[i]!;
    const next = rest[(i + 1) % rest.length]!;
    const a = coords[prev]!;
    const b = coords[curr]!;
    const c = coords[next]!;
    if (orient2dPoints(a, b, c) <= 0) {
      continue;
    }
    let contains = false;
    for (let j = 0; j < rest.length; j++) {
      if (j === i || j === (i - 1 + rest.length) % rest.length || j === (i + 1) % rest.length) {
        continue;
      }
      if (pointInTriangleCCW2d(coords[rest[j]!]!, a, b, c)) {
        contains = true;
        break;
      }
    }
    if (!contains) {
      return i;
    }
  }
  return -1;
}

function polygonSelfIntersects(coords: readonly Vec2[]): boolean {
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

function projectPolygon(points: readonly Vec3[], normal: Vec3): Vec2[] {
  return points.map((p) => projectPointToOrientedPlane2d(normal[0], normal[1], normal[2], p[0], p[1], p[2]));
}

function polygonNormal(points: readonly Vec3[]): Vec3 {
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

function maxPlaneDeviation(points: readonly Vec3[], origin: Vec3, unit: Vec3): number {
  let max = 0;
  for (const p of points) {
    const d = Math.abs(dot(sub(p, origin), unit));
    if (d > max) {
      max = d;
    }
  }
  return max;
}

function orderTriple(a: number, b: number, c: number, reversed: boolean): [number, number, number] {
  return reversed ? [a, c, b] : [a, b, c];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vectorLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function distanceSquared(a: Vec3, b: Vec3): number {
  const d = sub(a, b);
  return d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
}

export function polygonArea(points: readonly Vec3[]): number {
  return vectorLength(polygonNormal(points)) * 0.5;
}

export { polygonNormal };
