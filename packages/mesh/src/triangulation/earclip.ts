import { orient2dPoints, pointInTriangleCCW2d } from "@modeling-kit/math";
import type { Vec2 } from "./types";
import { orderTriple } from "./vec";

export function clipEars(
  cleanedIndices: readonly number[],
  coords: readonly Vec2[],
  reversed: boolean,
): { projected: [number, number, number][]; source: [number, number, number][] } | undefined {
  const rest = cleanedIndices.map((_, i) => i);
  const projected: [number, number, number][] = [];
  const source: [number, number, number][] = [];
  let guard = 0;
  const maxSteps = rest.length * rest.length + 8;

  while (rest.length > 3 && guard < maxSteps) {
    guard += 1;
    const ear = findEar(rest, coords);
    if (ear < 0) {
      return undefined;
    }
    const prev = rest[(ear - 1 + rest.length) % rest.length]!;
    const curr = rest[ear]!;
    const next = rest[(ear + 1) % rest.length]!;
    projected.push([prev, curr, next]);
    source.push(orderTriple(cleanedIndices[prev]!, cleanedIndices[curr]!, cleanedIndices[next]!, reversed));
    rest.splice(ear, 1);
  }

  if (rest.length !== 3) {
    return undefined;
  }
  projected.push([rest[0]!, rest[1]!, rest[2]!]);
  source.push(
    orderTriple(cleanedIndices[rest[0]!]!, cleanedIndices[rest[1]!]!, cleanedIndices[rest[2]!]!, reversed),
  );
  return { projected, source };
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
