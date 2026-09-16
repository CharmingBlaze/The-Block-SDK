import { readPosition } from "./attributes";
import type { CellOrientation, CellSpec } from "./convert-types";

export function orientCell(
  spec: CellSpec,
  positions: ArrayLike<number>,
  remap: boolean,
  orientation: CellOrientation,
): CellSpec {
  if (orientation === "preserve") {
    return spec;
  }
  const normal = cellNormal(spec, positions, remap);
  if (orientation === "positive-y") {
    return normal[1] < 0 ? reverseCell(spec) : spec;
  }
  const centroid = cellCentroid(spec, positions, remap);
  const outward = normal[0] * centroid[0] + normal[1] * centroid[1] + normal[2] * centroid[2];
  return outward < 0 ? reverseCell(spec) : spec;
}

function cellNormal(spec: CellSpec, positions: ArrayLike<number>, remap: boolean): [number, number, number] {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const n = spec.source.length;
  for (let i = 0; i < n; i++) {
    const a = readPosition(positions, spec.source[i]!, remap);
    const b = readPosition(positions, spec.source[(i + 1) % n]!, remap);
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function cellCentroid(spec: CellSpec, positions: ArrayLike<number>, remap: boolean): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of spec.source) {
    const p = readPosition(positions, index, remap);
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = spec.source.length || 1;
  return [x / n, y / n, z / n];
}

export function reverseCell(spec: CellSpec): CellSpec {
  return {
    source: [...spec.source].reverse(),
    vertices: [...spec.vertices].reverse(),
    uvs: [...spec.uvs].reverse(),
    normals: spec.normals ? [...spec.normals].reverse() : undefined,
  };
}
