import os from "node:os";
import { GRID_10K, GRID_100K, buildGrid, type GridSize } from "./fixtures.ts";
import { formatReport } from "./format-report.ts";
import { measureGrid } from "./measure-grid.ts";
import { measureMemory } from "./measure-memory.ts";
import { measureStages } from "./measure-stages.ts";
import { measureTriangulate } from "./measure-triangulate.ts";
import { gcIfAvailable } from "./memory.ts";
import type { WarmOptions } from "./stats.ts";

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === "1" || raw === "true";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sizes(): GridSize[] {
  const out: GridSize[] = [GRID_10K];
  if (envFlag("BENCH_LARGE", true)) {
    out.push(GRID_100K);
  }
  return out;
}

function warmFor(size: GridSize): WarmOptions {
  if (size.id === "100k") {
    return { warmup: envInt("BENCH_WARMUP", 1), samples: envInt("BENCH_SAMPLES_LARGE", 3) };
  }
  return { warmup: envInt("BENCH_WARMUP", 1), samples: envInt("BENCH_SAMPLES", 5) };
}

function stageWarm(size: GridSize): WarmOptions {
  return { warmup: 1, samples: size.id === "100k" ? 1 : 3 };
}

function main(): void {
  const gcExposed = gcIfAvailable();
  const grids = [];
  const triangulate = [];
  const stages = [];
  const memory = [];

  for (const size of sizes()) {
    process.stderr.write(`measuring ${size.id} grid construction…\n`);
    const grid = measureGrid(size, warmFor(size));
    grids.push(grid);
    process.stderr.write(`measuring ${size.id} triangulateMesh…\n`);
    const mesh = buildGrid(size);
    triangulate.push(measureTriangulate(size, mesh, warmFor(size)));
    if (size.id !== "100k") {
      process.stderr.write(`measuring ${size.id} stages…\n`);
      stages.push(measureStages(size, mesh, stageWarm(size)));
    }
    process.stderr.write(`measuring ${size.id} memory…\n`);
    memory.push(measureMemory(size));
  }

  const report = formatReport({
    machine: `${os.platform()} ${os.arch()} ${os.cpus()[0]?.model ?? "unknown"}`,
    node: process.version,
    gcExposed,
    grids,
    triangulate,
    stages,
    memory,
  });
  process.stdout.write(`${report}\n`);
}

main();
