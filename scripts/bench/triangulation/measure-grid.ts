import { buildGrid, expectedFaceCount, expectedVertexCount, type GridSize } from "./fixtures.ts";
import { warmedMeasure, type SampleStats, type WarmOptions } from "./stats.ts";

export interface GridMeasure {
  readonly size: GridSize;
  readonly vertices: number;
  readonly faces: number;
  readonly stats: SampleStats;
}

export function measureGrid(size: GridSize, options?: WarmOptions): GridMeasure {
  const stats = warmedMeasure(`generateGrid ${size.id}`, () => {
    const mesh = buildGrid(size);
    if (mesh.vertices.size !== expectedVertexCount(size)) {
      throw new Error(`grid ${size.id} vertex count ${mesh.vertices.size}`);
    }
  }, options);
  return {
    size,
    vertices: expectedVertexCount(size),
    faces: expectedFaceCount(size),
    stats,
  };
}
