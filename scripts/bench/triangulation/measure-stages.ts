import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { GridSize } from "./fixtures.ts";
import {
  copyFaceTuples,
  copyFaceVector3,
  fanTessellate,
  triangulateFaces,
  walkFaceLoops,
} from "./stages.ts";
import { warmedMeasure, type SampleStats, type WarmOptions } from "./stats.ts";

export interface StageMeasure {
  readonly size: GridSize;
  readonly stages: readonly SampleStats[];
}

export function measureStages(size: GridSize, mesh: HalfEdgeMesh, options?: WarmOptions): StageMeasure {
  const stages = [
    warmedMeasure("walk getFaceVertices+Corners", () => {
      walkFaceLoops(mesh);
    }, options),
    warmedMeasure("copy position tuples", () => {
      copyFaceTuples(mesh);
    }, options),
    warmedMeasure("copy Vector3 (current triangulateMesh)", () => {
      copyFaceVector3(mesh);
    }, options),
    warmedMeasure("fan tessellate (no predicates)", () => {
      fanTessellate(mesh);
    }, options),
    warmedMeasure("triangulatePolygon rejectSelfIntersecting=false", () => {
      triangulateFaces(mesh, false);
    }, options),
    warmedMeasure("triangulatePolygon rejectSelfIntersecting=true", () => {
      triangulateFaces(mesh, true);
    }, options),
    warmedMeasure("triangulateMesh (full derived buffers)", () => {
      triangulateMesh(mesh);
    }, options),
  ];
  return { size, stages };
}
