# Large-mesh triangulation (R3 / 1.1)

**Status:** Investigation + profiler. Not a 0.1 gate.  
**Date:** 2026-09-16  
**Related:** [`docs/guides/triangulation.md`](../guides/triangulation.md), PERF-001

0.1 records wall-clock samples and keeps them out of `pnpm test`. A 2026-09-16 re-audit one-shot on a shared-load machine reported 2.67 s / 18.9 s for `triangulateMesh`. **Warmed medians on 2026-09-16 (Ryzen 7 250, Node 26) are 67 ms / 731 ms for triangulation and 246 ms / 3.68 s for `generateGrid`.** Grid construction is the large-mesh cost. This folder is the 1.1 work: split those two, record medians and memory, then change the actual bottleneck.

## Run

```text
pnpm bench:triangulation
# 10k only:
BENCH_LARGE=0 pnpm bench:triangulation
```

`--expose-gc` is on the npm script so heap deltas can GC between phases. Without it, memory rows still print but are noisier.

Modular profiler (do not collapse into one file):

| File | Owns |
| --- | --- |
| `scripts/bench/triangulation/stats.ts` | Warmup + median/mean |
| `scripts/bench/triangulation/memory.ts` | `heapUsed` / optional `gc()` |
| `scripts/bench/triangulation/fixtures.ts` | 10k / 100k grids (same sizes as the 0.1 bench) |
| `scripts/bench/triangulation/stages.ts` | Walk / copy / fan / `triangulatePolygon` probes |
| `scripts/bench/triangulation/measure-*.ts` | One concern each |
| `scripts/bench/triangulation/run.ts` | Orchestration + report |

Structural CI samples stay in `packages/sdk/tests/triangulation.bench.test.ts` via `pnpm test:bench`.

## Read in order

1. [literature.md](./literature.md) — what other engines do (Earcut, Blender tessface, incremental CDT).
2. [hot-path.md](./hot-path.md) — what *this* repo does per face today.
3. [samples.md](./samples.md) then [plan.md](./plan.md) — Phase A is measured; B1 is grid, B2 is tessellation.

## Constraint

Derived triangulation stays derived. Do not store GPU indices on the kernel. Do not import `three`. Do not add WASM/Earcut.hpp unless a later phase proves the TypeScript wrapper is not the bottleneck.
