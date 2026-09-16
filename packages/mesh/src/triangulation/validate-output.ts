import { orient2dPoints, polygonTwiceSignedArea2d } from "@modeling-kit/math";
import type { PolygonTriangulation, Vec2 } from "./types";

export function emptyTriangulation(
  status: PolygonTriangulation["status"],
  extra: Partial<PolygonTriangulation> = {},
): PolygonTriangulation {
  return {
    triangles: [],
    status,
    nonPlanar: extra.nonPlanar ?? false,
    reversed: extra.reversed ?? false,
    backend: extra.backend ?? "earclip",
    sourceVertexIndices: [],
  };
}

export function triangleTwiceArea(a: Vec2, b: Vec2, c: Vec2): number {
  return orient2dPoints(a, b, c);
}

export function validateTriangles(
  triangles: readonly (readonly [number, number, number])[],
  projected: readonly Vec2[],
  sourceArea: number,
  areaTolerance: number,
): string | undefined {
  if (triangles.length === 0) {
    return "no triangles";
  }
  let twice = 0;
  const vertexCount = projected.length;
  for (const tri of triangles) {
    const a = tri[0]!;
    const b = tri[1]!;
    const c = tri[2]!;
    if (a < 0 || b < 0 || c < 0 || a >= vertexCount || b >= vertexCount || c >= vertexCount) {
      return "triangle index out of range";
    }
    if (a === b || b === c || c === a) {
      return "degenerate triangle indices";
    }
    const area = triangleTwiceArea(projected[a]!, projected[b]!, projected[c]!);
    if (area === 0) {
      return "zero-area triangle";
    }
    if (area < 0) {
      return "reversed triangle winding";
    }
    twice += area;
  }
  const expected = Math.abs(sourceArea);
  const got = Math.abs(twice);
  const denom = Math.max(expected, 1e-20);
  if (Math.abs(got - expected) / denom > areaTolerance) {
    return "triangulated area mismatch";
  }
  return undefined;
}

export function boundaryEdgesRepresented(
  triangles: readonly (readonly [number, number, number])[],
  loopLengths: readonly number[],
): boolean {
  const seen = new Set<string>();
  for (const tri of triangles) {
    addUndirected(seen, tri[0]!, tri[1]!);
    addUndirected(seen, tri[1]!, tri[2]!);
    addUndirected(seen, tri[2]!, tri[0]!);
  }
  let offset = 0;
  for (const length of loopLengths) {
    for (let i = 0; i < length; i++) {
      const a = offset + i;
      const b = offset + ((i + 1) % length);
      if (!seen.has(edgeKey(a, b))) {
        return false;
      }
    }
    offset += length;
  }
  return true;
}

function addUndirected(seen: Set<string>, a: number, b: number): void {
  seen.add(edgeKey(a, b));
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function sourceArea2d(outer: readonly Vec2[], holes: readonly (readonly Vec2[])[]): number {
  let area = polygonTwiceSignedArea2d(outer);
  for (const hole of holes) {
    area -= Math.abs(polygonTwiceSignedArea2d(hole));
  }
  return area;
}
