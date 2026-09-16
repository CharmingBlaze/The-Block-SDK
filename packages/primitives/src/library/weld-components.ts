import { readPosition } from "./attributes";
import { IndexUnion } from "./weld-union";

export const COINCIDENT_EPSILON = 1e-6;

export function unionZeroLengthCellEdges(
  unions: IndexUnion,
  positions: ArrayLike<number>,
  cells: ArrayLike<number>,
  cellSize: 3 | 4,
  remap: boolean,
): void {
  const cellCount = cells.length / cellSize;
  for (let c = 0; c < cellCount; c++) {
    for (let k = 0; k < cellSize; k++) {
      const a = cells[c * cellSize + k]!;
      const b = cells[c * cellSize + ((k + 1) % cellSize)]!;
      const pa = readPosition(positions, a, remap);
      const pb = readPosition(positions, b, remap);
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) < COINCIDENT_EPSILON) {
        unions.union(a, b);
      }
    }
  }
}

export function unionCoincidentSources(
  unions: IndexUnion,
  positions: ArrayLike<number>,
  remap: boolean,
  indices: readonly number[],
): void {
  const groups = new Map<string, number>();
  for (const index of indices) {
    const key = quantizedKey(readPosition(positions, index, remap));
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, index);
    } else {
      unions.union(existing, index);
    }
  }
}

function quantizedKey(position: readonly [number, number, number]): string {
  const quantize = (value: number): number => Math.round((value + 0) / COINCIDENT_EPSILON);
  return `${quantize(position[0])},${quantize(position[1])},${quantize(position[2])}`;
}
