import { generateGrid, type GridParameters } from "@modeling-kit/primitives";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";

export interface GridSize {
  readonly id: "10k" | "100k";
  readonly label: string;
  readonly parameters: GridParameters;
}

/** Matches `packages/sdk/tests/triangulation.bench.test.ts` and docs/guides/triangulation.md. */
export const GRID_10K: GridSize = {
  id: "10k",
  label: "~10k vertices (segments 100×100)",
  parameters: { width: 1, depth: 1, segmentsX: 100, segmentsZ: 100 },
};

export const GRID_100K: GridSize = {
  id: "100k",
  label: "~100k vertices (segments 316×316)",
  parameters: { width: 1, depth: 1, segmentsX: 316, segmentsZ: 316 },
};

export function expectedVertexCount(size: GridSize): number {
  return (size.parameters.segmentsX + 1) * (size.parameters.segmentsZ + 1);
}

export function expectedFaceCount(size: GridSize): number {
  return size.parameters.segmentsX * size.parameters.segmentsZ;
}

export function buildGrid(size: GridSize): HalfEdgeMesh {
  return generateGrid(size.parameters).mesh;
}
