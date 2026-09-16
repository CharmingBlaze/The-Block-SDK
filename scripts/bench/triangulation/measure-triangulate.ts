import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { GridSize } from "./fixtures.ts";
import { warmedMeasure, type SampleStats, type WarmOptions } from "./stats.ts";

export interface TriangulateMeasure {
  readonly size: GridSize;
  readonly triangleCount: number;
  readonly stats: SampleStats;
}

export function measureTriangulate(
  size: GridSize,
  mesh: HalfEdgeMesh,
  options?: WarmOptions,
): TriangulateMeasure {
  let triangleCount = 0;
  const stats = warmedMeasure(`triangulateMesh ${size.id}`, () => {
    const tri = triangulateMesh(mesh);
    triangleCount = tri.indices.length / 3;
  }, options);
  return { size, triangleCount, stats };
}
