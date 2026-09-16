import earcut, { deviation } from "earcut";
import type { Vec2 } from "./types";
import { flattenXY } from "./vec";

export interface EarcutLoopInput {
  readonly coords: readonly Vec2[];
  readonly sourceIndices: readonly number[];
}

export function triangulateWithEarcut(
  outer: EarcutLoopInput,
  holes: readonly EarcutLoopInput[],
  areaTolerance: number,
): { local: [number, number, number][]; source: [number, number, number][] } | undefined {
  const coords: Vec2[] = [...outer.coords];
  const sources: number[] = [...outer.sourceIndices];
  const holeStarts: number[] = [];
  for (const hole of holes) {
    holeStarts.push(coords.length);
    coords.push(...hole.coords);
    sources.push(...hole.sourceIndices);
  }

  const data = flattenXY(coords);
  const holeArg = holeStarts.length > 0 ? holeStarts : undefined;
  const indices = earcut(data, holeArg, 2);
  if (indices.length < 3 || indices.length % 3 !== 0) {
    return undefined;
  }
  const relative = deviation(data, holeArg, 2, indices);
  if (!Number.isFinite(relative) || relative > areaTolerance) {
    return undefined;
  }

  const local: [number, number, number][] = [];
  const source: [number, number, number][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]!;
    const b = indices[i + 1]!;
    const c = indices[i + 2]!;
    const sa = sources[a];
    const sb = sources[b];
    const sc = sources[c];
    if (sa === undefined || sb === undefined || sc === undefined) {
      return undefined;
    }
    local.push([a, b, c]);
    source.push([sa, sb, sc]);
  }
  return { local, source };
}
