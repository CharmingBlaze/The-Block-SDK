import { clipEars } from "./earclip";
import { triangulateWithEarcut } from "./earcut-backend";
import type { PolygonTriangulation, TriangulationBackendUsed, Vec2 } from "./types";
import {
  boundaryEdgesRepresented,
  sourceArea2d,
  validateTriangles,
} from "./validate-output";
import { orderTriple } from "./vec";

export function runTriangulationBackend(
  backend: TriangulationBackendUsed,
  outerSource: readonly number[],
  outerProjected: readonly Vec2[],
  holes: readonly { coords: readonly Vec2[]; source: readonly number[] }[],
  reversed: boolean,
  areaTolerance: number,
): Omit<PolygonTriangulation, "nonPlanar" | "reversed"> | undefined {
  const projectedAll = [...outerProjected, ...holes.flatMap((hole) => hole.coords)];
  const sourceAll = [...outerSource, ...holes.flatMap((hole) => hole.source)];
  let local: [number, number, number][] | undefined;

  if (backend === "earclip") {
    if (holes.length > 0) {
      return undefined;
    }
    local = clipEars(outerSource, outerProjected, reversed)?.projected;
  } else {
    const cut = triangulateWithEarcut(
      { coords: outerProjected, sourceIndices: outerSource },
      holes.map((hole) => ({ coords: hole.coords, sourceIndices: hole.source })),
      areaTolerance,
    );
    local = cut?.local;
  }
  if (!local) {
    return undefined;
  }

  const areaError = validateTriangles(
    local,
    projectedAll,
    sourceArea2d(
      outerProjected,
      holes.map((hole) => hole.coords),
    ),
    areaTolerance,
  );
  if (areaError) {
    return undefined;
  }
  const loopLengths = [outerProjected.length, ...holes.map((hole) => hole.coords.length)];
  if (!boundaryEdgesRepresented(local, loopLengths)) {
    return undefined;
  }

  const sourceTriangles = local.map((tri) => {
    const a = sourceAll[tri[0]!]!;
    const b = sourceAll[tri[1]!]!;
    const c = sourceAll[tri[2]!]!;
    return orderTriple(a, b, c, reversed);
  });
  return {
    triangles: sourceTriangles,
    status: "ok",
    backend,
    sourceVertexIndices: sourceTriangles,
  };
}
