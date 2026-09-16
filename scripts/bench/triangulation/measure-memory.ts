import { triangulateMesh } from "@modeling-kit/mesh";
import { buildGrid, type GridSize } from "./fixtures.ts";
import { deltaHeapUsed, gcIfAvailable, readHeap, type HeapSample } from "./memory.ts";

export interface MemoryMeasure {
  readonly size: GridSize;
  readonly gcExposed: boolean;
  readonly baseline: HeapSample;
  readonly afterGrid: HeapSample;
  readonly afterTriangulate: HeapSample;
  readonly afterDropTri: HeapSample;
  readonly afterDropAll: HeapSample;
  readonly gridHeapUsed: number;
  readonly triHeapUsed: number;
}

export function measureMemory(size: GridSize): MemoryMeasure {
  gcIfAvailable();
  const baseline = readHeap();

  const live: { mesh?: ReturnType<typeof buildGrid>; tri?: ReturnType<typeof triangulateMesh> } = {};
  live.mesh = buildGrid(size);
  gcIfAvailable();
  const afterGrid = readHeap();

  live.tri = triangulateMesh(live.mesh);
  void live.tri.indices.length;
  gcIfAvailable();
  const afterTriangulate = readHeap();

  live.tri = undefined;
  gcIfAvailable();
  const afterDropTri = readHeap();

  live.mesh = undefined;
  gcIfAvailable();
  const afterDropAll = readHeap();

  return {
    size,
    gcExposed: baseline.gcExposed,
    baseline,
    afterGrid,
    afterTriangulate,
    afterDropTri,
    afterDropAll,
    gridHeapUsed: deltaHeapUsed(baseline, afterGrid),
    triHeapUsed: deltaHeapUsed(afterGrid, afterTriangulate),
  };
}
