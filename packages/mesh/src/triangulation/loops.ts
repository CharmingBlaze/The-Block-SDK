import { polygonTwiceSignedArea2d } from "@modeling-kit/math";
import { collapseNearlyDuplicateAndCollinear } from "./cleanup";
import { chooseTriangulationBackend } from "./choose";
import { clipEars } from "./earclip";
import { triangulateWithEarcut } from "./earcut-backend";
import { flipY, maxPlaneDeviation, projectPolygon, unitNormalOrNull } from "./project";
import type {
  PolygonTriangulation,
  PolygonTriangulationOptions,
  TriangulationBackendUsed,
  Vec2,
  Vec3,
} from "./types";
import { polygonSelfIntersects, polygonSelfIntersects3d, requireFiniteLoops } from "./validate-input";
import {
  boundaryEdgesRepresented,
  emptyTriangulation,
  sourceArea2d,
  validateTriangles,
} from "./validate-output";
import { orderTriple } from "./vec";

export function triangulatePolygon(
  points: readonly Vec3[],
  options: PolygonTriangulationOptions = {},
): PolygonTriangulation {
  return triangulatePolygonLoops(points, options.holes ?? [], options);
}

export function triangulatePolygonLoops(
  outer: readonly Vec3[],
  holes: readonly (readonly Vec3[])[] = [],
  options: PolygonTriangulationOptions = {},
): PolygonTriangulation {
  const epsilon = options.epsilon ?? 1e-10;
  const rejectSelfIntersecting = options.rejectSelfIntersecting ?? true;
  const areaTolerance = options.areaTolerance ?? 1e-4;
  const requested = options.backend ?? "auto";

  requireFiniteLoops("triangulatePolygon", [outer, ...holes]);
  if (outer.length < 3) {
    return emptyTriangulation("degenerate");
  }

  const cleanedOuter = collapseNearlyDuplicateAndCollinear(outer, epsilon);
  if (cleanedOuter.indices.length < 3) {
    return emptyTriangulation("degenerate");
  }
  const cleanedHoles = holes.map((hole) => collapseNearlyDuplicateAndCollinear(hole, epsilon));
  if (cleanedHoles.some((hole) => hole.indices.length < 3)) {
    return emptyTriangulation("degenerate");
  }
  if (
    rejectSelfIntersecting &&
    (polygonSelfIntersects3d(cleanedOuter.points) || cleanedHoles.some((hole) => polygonSelfIntersects3d(hole.points)))
  ) {
    return emptyTriangulation("self-intersecting");
  }

  const unit = unitNormalOrNull(cleanedOuter.points, epsilon);
  if (!unit) {
    return emptyTriangulation("degenerate");
  }
  const nonPlanar =
    maxPlaneDeviation(cleanedOuter.points, cleanedOuter.points[0]!, unit) > Math.max(epsilon * 10, 1e-6);

  let outerProjected = projectPolygon(cleanedOuter.points, unit);
  let holeProjected = cleanedHoles.map((hole) => projectPolygon(hole.points, unit));
  if (
    polygonSelfIntersects(outerProjected) ||
    holeProjected.some((hole) => polygonSelfIntersects(hole))
  ) {
    if (rejectSelfIntersecting) {
      const reversedEarly = polygonTwiceSignedArea2d(outerProjected) < 0;
      return emptyTriangulation("self-intersecting", { nonPlanar, reversed: reversedEarly });
    }
  }
  const reversed = polygonTwiceSignedArea2d(outerProjected) < 0;
  if (reversed) {
    outerProjected = flipY(outerProjected);
    holeProjected = holeProjected.map(flipY);
  }

  const outerSource = [...cleanedOuter.indices];

  const alignedHoles: { coords: Vec2[]; source: number[] }[] = [];
  let holeOffset = outer.length;
  for (let h = 0; h < holeProjected.length; h++) {
    let coords = holeProjected[h]!;
    const source = cleanedHoles[h]!.indices.map((index) => holeOffset + index);
    if (polygonTwiceSignedArea2d(coords) > 0) {
      coords = [...coords].reverse();
      source.reverse();
    }
    alignedHoles.push({ coords, source });
    holeOffset += holes[h]!.length;
  }

  if (
    polygonSelfIntersects(outerProjected) ||
    alignedHoles.some((hole) => polygonSelfIntersects(hole.coords))
  ) {
    if (rejectSelfIntersecting) {
      return emptyTriangulation("self-intersecting", { nonPlanar, reversed });
    }
  }

  if (outerProjected.length === 3 && alignedHoles.length === 0) {
    const tri = orderTriple(outerSource[0]!, outerSource[1]!, outerSource[2]!, reversed);
    return {
      triangles: [tri],
      status: "ok",
      nonPlanar,
      reversed,
      backend: "earclip",
      sourceVertexIndices: [tri],
    };
  }

  const backend = chooseTriangulationBackend(
    outerProjected,
    alignedHoles.map((hole) => hole.coords),
    requested,
  );
  const result = runBackend(backend, outerSource, outerProjected, alignedHoles, reversed, areaTolerance);
  if (result) {
    return { ...result, nonPlanar, reversed };
  }
  if (backend === "earcut" && requested !== "earcut" && alignedHoles.length === 0) {
    const fallback = runBackend("earclip", outerSource, outerProjected, [], reversed, areaTolerance);
    if (fallback) {
      return { ...fallback, nonPlanar, reversed };
    }
  }
  return emptyTriangulation(
    alignedHoles.length === 0 && rejectSelfIntersecting ? "self-intersecting" : "failed",
    { nonPlanar, reversed, backend },
  );
}

function runBackend(
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
