import { formatBytes, formatMs, type SampleStats } from "./stats.ts";
import type { GridMeasure } from "./measure-grid.ts";
import type { TriangulateMeasure } from "./measure-triangulate.ts";
import type { StageMeasure } from "./measure-stages.ts";
import type { MemoryMeasure } from "./measure-memory.ts";

function statsLine(stats: SampleStats): string {
  return `${stats.label.padEnd(52)} median ${formatMs(stats.medianMs).padStart(10)}  cold ${formatMs(stats.coldMs).padStart(10)}  min ${formatMs(stats.minMs).padStart(10)}  max ${formatMs(stats.maxMs).padStart(10)}`;
}

export function formatReport(input: {
  readonly machine: string;
  readonly node: string;
  readonly gcExposed: boolean;
  readonly grids: readonly GridMeasure[];
  readonly triangulate: readonly TriangulateMeasure[];
  readonly stages: readonly StageMeasure[];
  readonly memory: readonly MemoryMeasure[];
}): string {
  const lines = [
    "# Large-mesh triangulation profile",
    "",
    `Machine: ${input.machine}`,
    `Node: ${input.node}`,
    `GC exposed: ${input.gcExposed}`,
    "Warmup discarded; times are warmed medians unless labelled cold.",
    "",
    "## Grid construction vs triangulateMesh",
    "",
  ];
  for (const grid of input.grids) {
    const tri = input.triangulate.find((item) => item.size.id === grid.size.id);
    lines.push(`### ${grid.size.label}`);
    lines.push("");
    lines.push(`- vertices ${grid.vertices}, faces ${grid.faces}${tri ? `, triangles ${tri.triangleCount}` : ""}`);
    lines.push(`- ${statsLine(grid.stats)}`);
    if (tri) {
      lines.push(`- ${statsLine(tri.stats)}`);
    }
    lines.push("");
  }
  lines.push("## Stage breakdown (same mesh, warmed median)");
  lines.push("");
  for (const stage of input.stages) {
    lines.push(`### ${stage.size.label}`);
    lines.push("");
    for (const sample of stage.stages) {
      lines.push(`- ${statsLine(sample)}`);
    }
    lines.push("");
  }
  lines.push("## Memory (heapUsed after GC when available)");
  lines.push("");
  for (const mem of input.memory) {
    lines.push(`### ${mem.size.label}`);
    lines.push("");
    lines.push(`- baseline ${formatBytes(mem.baseline.heapUsed)}`);
    lines.push(`- after generateGrid ${formatBytes(mem.afterGrid.heapUsed)} (delta ${formatBytes(mem.gridHeapUsed)})`);
    lines.push(`- after triangulateMesh ${formatBytes(mem.afterTriangulate.heapUsed)} (delta ${formatBytes(mem.triHeapUsed)})`);
    lines.push(`- after drop triangles ${formatBytes(mem.afterDropTri.heapUsed)}`);
    lines.push(`- after drop mesh ${formatBytes(mem.afterDropAll.heapUsed)}`);
    lines.push("");
  }
  return lines.join("\n");
}
