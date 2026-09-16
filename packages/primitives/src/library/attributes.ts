import { SchemaError } from "@modeling-kit/core";
import type { Aabb } from "./convert-types";

export function hasAttribute(
  values: ArrayLike<number> | undefined,
  expected: number,
  label: string,
): boolean {
  if (!values || values.length === 0) {
    return false;
  }
  if (values.length !== expected) {
    throw new SchemaError(`${label} length must be ${expected}`);
  }
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      return false;
    }
  }
  return true;
}

export function weldKey(position: readonly [number, number, number]): string {
  const quantize = (value: number): number => Math.round((value + 0) * 1e6);
  return `${quantize(position[0])},${quantize(position[1])},${quantize(position[2])}`;
}

export function polygonArea(points: readonly (readonly [number, number, number])[]): number {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(nx, ny, nz) * 0.5;
}

export function readPosition(
  positions: ArrayLike<number>,
  index: number,
  remap: boolean,
): [number, number, number] {
  const x = positions[index * 3] ?? 0;
  const y = positions[index * 3 + 1] ?? 0;
  const z = positions[index * 3 + 2] ?? 0;
  return remap ? [x, z, -y] : [x, y, z];
}

export function readNormal(
  normals: ArrayLike<number>,
  index: number,
  remap: boolean,
): [number, number, number] {
  const x = normals[index * 3] ?? 0;
  const y = normals[index * 3 + 1] ?? 0;
  const z = normals[index * 3 + 2] ?? 0;
  const n: [number, number, number] = remap ? [x, z, -y] : [x, y, z];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-12) {
    return [0, 1, 0];
  }
  return [n[0] / len, n[1] / len, n[2] / len];
}

export function computeBounds(positions: ArrayLike<number>, remap: boolean): Aabb {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    const p = readPosition(positions, i, remap);
    min[0] = Math.min(min[0], p[0]);
    min[1] = Math.min(min[1], p[1]);
    min[2] = Math.min(min[2], p[2]);
    max[0] = Math.max(max[0], p[0]);
    max[1] = Math.max(max[1], p[1]);
    max[2] = Math.max(max[2], p[2]);
  }
  return {
    min,
    span: [
      Math.max(max[0] - min[0], 1e-8),
      Math.max(max[1] - min[1], 1e-8),
      Math.max(max[2] - min[2], 1e-8),
    ],
  };
}

export function fallbackUv(
  positions: ArrayLike<number>,
  index: number,
  remap: boolean,
  bounds: Aabb,
): [number, number] {
  const p = readPosition(positions, index, remap);
  return [(p[0] - bounds.min[0]) / bounds.span[0], (p[2] - bounds.min[2]) / bounds.span[2]];
}
