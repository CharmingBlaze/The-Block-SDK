# xatlas / watlas integration spike

**Date:** 2026-09-16  
**Feature name:** Automatic chart unwrap  
**Wrapper:** [watlas](https://github.com/toji/watlas) 1.0.1  
**Underlying library:** [xatlas](https://github.com/jpcy/xatlas) snapshot vendored by watlas (MIT, Jonathan Young; thekla_atlas lineage)

This spike is not a public API. It proved the WASM wrapper before `automaticUnwrap` was added.

xatlas is a chart-based atlas generator. It is **not** the SDK’s exact LSCM or ABF++ feature. Those remain deferred.

## Evidence

`pnpm exec vitest run packages/uv/tests/xatlas-integration.spike.test.ts` — 5 passed (Node init, cube/sphere/torus/concave n-gon, dispose cycles, `worker_threads`).

## Record

| Item | Result |
| --- | --- |
| Wrapper version | watlas **1.0.1** (MIT, Brandon Jones) |
| Underlying xatlas version | No semver in the vendored `xatlas.h`. Snapshot shipped with watlas 1.0.1. |
| License | watlas MIT; xatlas MIT; thekla_atlas MIT |
| WASM size | `dist/watlas.wasm` **225,384 bytes** (~220.1 KiB). JS glue **90,332 bytes**. |
| Initialization | `await watlas.Initialize()` once per module. Idempotent. `new watlas.Atlas()` throws until init. |
| Browser support | Glue detects `ENVIRONMENT_IS_WEB`. Vite consumers should not bundle the WASM away from `import.meta.url`. Prefer `optimizeDeps.exclude: ['watlas']` if a bundler fails to resolve `watlas.wasm`. |
| Node support | Proven in Node 22 via Vitest. `createRequire(import.meta.url)` loads the WASM file next to `watlas.js`. |
| Worker support | Proven in `worker_threads` (`packages/uv/tests/xatlas-spike.worker.mjs`). Glue also detects `ENVIRONMENT_IS_WORKER`. |
| Input requirements | Triangles: `Float32Array` positions, `vertexPositionStride: 12`, `Uint32Array`/`Uint16Array` indices. Optional `vertexUvData`, `faceMaterialData`, `faceVertexCount`. **No seam-edge array.** Native `faceIgnoreData` and `SetProgressCallback` are **not** exposed by watlas 1.0.1. |
| Output format | `atlas.width` / `atlas.height` in texels. Vertex `uv` is texel space: `u = uv[0] / width`, `v = uv[1] / height`. |
| Vertex-reference behavior | `vertex.xref` is the original input vertex index. Output vertex count may exceed input count at UV seams. |
| Chart options | `maxChartArea`, `maxBoundaryLength`, weights, `maxCost`, `maxIterations`, `useInputMeshUvs`, `fixWinding`. |
| Packing options | `padding`, `resolution`, `texelsPerUnit`, `bilinear`, `blockAlign`, `bruteForce`, `rotateCharts`, `rotateChartsToAxis`. |
| Cancellation support | **Not** exposed. `AbortSignal` can only be honored before/after `generate()`, or by terminating a worker. |
| Memory lifecycle | `atlas.delete()` required. WASM module stays loaded; there is no `Uninitialize`. Repeated create/generate/delete does not keep Atlas instances. |
| Packaging | npm package files: `dist/watlas.js`, `dist/watlas.wasm`, `dist/watlas.d.ts`. `@modeling-kit/uv` depends on `watlas` and must not bundle it into tsup output. |
| Known limitations | No explicit seam constraints. `useInputMeshUvs` is per-vertex, not per-corner. `computeCharts` already parameterizes. `packCharts` needs a live Atlas. Progress/cancel callbacks missing. |

## Mesh cases

Cube (12 triangles), UV sphere, torus, and a concave L n-gon after canonical triangulation all returned finite UVs, original-vertex `xref` values, and the original triangle count.

## Decision

Proceed with watlas as the first `UvUnwrapBackend`. Do not implement LSCM or ABF++ in TypeScript. If quality later fails product requirements, evaluate OpenABF as a future backend behind the same interface.
