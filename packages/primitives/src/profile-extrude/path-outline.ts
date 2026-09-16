import { SchemaError } from "@modeling-kit/core";
import type { ProfilePoint } from "./types";

const MITER_LIMIT = 4;

/** Stroke an open path into a closed outline so `extrudePolygon` can be used. */
export function strokePathToPolygon(points: readonly ProfilePoint[], lineWidth: number): ProfilePoint[] {
  if (!(lineWidth > 0) || !Number.isFinite(lineWidth)) {
    throw new SchemaError("path extrusion requires a positive lineWidth");
  }
  if (points.length < 2) {
    throw new SchemaError("path needs at least 2 points");
  }
  const half = lineWidth / 2;
  const left: ProfilePoint[] = [];
  const right: ProfilePoint[] = [];
  const last = points.length - 1;
  for (let i = 0; i <= last; i++) {
    const point = points[i]!;
    const offset =
      i === 0
        ? scaledNormal(points[0]!, points[1]!, half)
        : i === last
          ? scaledNormal(points[last - 1]!, points[last]!, half)
          : miterOffset(points[i - 1]!, point, points[i + 1]!, half);
    left.push([point[0] + offset[0], point[1] + offset[1]]);
    right.push([point[0] - offset[0], point[1] - offset[1]]);
  }
  const ring: ProfilePoint[] = [...left, ...right.reverse()];
  if (ring.length < 3) {
    throw new SchemaError("path outline produced no polygon");
  }
  return ring;
}

function scaledNormal(a: ProfilePoint, b: ProfilePoint, length: number): readonly [number, number] {
  const n = unitNormal(a, b);
  return [n[0] * length, n[1] * length];
}

function unitNormal(a: ProfilePoint, b: ProfilePoint): readonly [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-12)) {
    throw new SchemaError("path segments must have positive length");
  }
  return [-dy / len, dx / len];
}

function miterOffset(
  prev: ProfilePoint,
  point: ProfilePoint,
  next: ProfilePoint,
  half: number,
): readonly [number, number] {
  const n0 = unitNormal(prev, point);
  const n1 = unitNormal(point, next);
  const mx = n0[0] + n1[0];
  const my = n0[1] + n1[1];
  const len = Math.hypot(mx, my);
  if (len < 1e-8) {
    return [n0[0] * half, n0[1] * half];
  }
  const nx = mx / len;
  const ny = my / len;
  const cos = n0[0] * nx + n0[1] * ny;
  const scale = cos > 1e-6 ? half / cos : half;
  const clamped = Math.min(scale, half * MITER_LIMIT);
  return [nx * clamped, ny * clamped];
}
