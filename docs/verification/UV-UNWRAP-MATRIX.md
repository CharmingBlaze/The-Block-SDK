# Automatic chart unwrap verification matrix

Feature name: **Automatic chart unwrap**. Not LSCM/ABF++.

## Test backends

| Kind | Files | What it proves |
| --- | --- | --- |
| Real xatlas / watlas | `meshes.test.ts`, `mapping.test.ts`, `triangulation.test.ts` (topology + editable-vertex), `selection.test.ts`, `backend.test.ts`, `atlas-lifecycle.test.ts` (repeat/cancel), `history.test.ts`, `runtime.test.ts` (inline pool), `seams.test.ts` (channel isolation), `xatlas-integration.spike.test.ts`, `commands/tests/automatic-unwrap.test.ts` (undo/redo), `workers/tests/unwrap-uv.test.ts`, `workers/tests/workers.browser.test.ts` (unwrap-uv), `scripts/pack-verify.ts` | WASM init, charts, xref, apply, packaging |
| Mock `UvUnwrapBackend` | `failures.test.ts` (backend/conversion/validation), `commands/tests/automatic-unwrap.test.ts` (prepare failure) | Mesh unchanged; no history entry |
| Pure conversion / seams (no xatlas) | `convert.test.ts`, `seams.test.ts` (discontinuity + islands), `triangulation.test.ts` (n-gon mapping), `atlas-lifecycle.test.ts` (`withAtlas` fake Atlas), `failures.test.ts` (apply rollback) | Corner conflicts, seam rules, atlas `delete()` |
| Worker backend | `runtime.test.ts` (`WorkerPoolUnwrapBackend` + inline pool), `workers/tests/unwrap-uv.test.ts`, `workers.browser.test.ts` | Typed-array unwrap, dispose/cancel |
| Packed package | `scripts/pack-verify.ts` `@modeling-kit/uv#automatic-unwrap` | Tarball + real `automaticUnwrap` |
| Browser runtime | `workers.browser.test.ts` fake `Worker` posting `unwrap-uv` | Async worker message path; xatlas still runs in the Vitest isolate |
| SSR / unused import | `runtime.test.ts` | `window` undefined; disposed backend never `Initialize()`s |

## Basic meshes (real xatlas)

| Case | Test | Gate |
| --- | --- | --- |
| Triangle, quad, cube, subdivided cube | `packages/uv/tests/unwrap/meshes.test.ts` | finite UVs, topology unchanged |
| Concave n-gon | same + `triangulation.test.ts` | canonical triangulation then unwrap; mapping follows `triangulatePolygon`, not a naive fan |
| Cylinder, UV sphere, quad sphere, torus, capsule | `meshes.test.ts` | finite UVs |
| Disconnected components | same | islands > 0 |

## Canonical topology (real xatlas)

| Case | Test | Gate |
| --- | --- | --- |
| Vertex/edge/face/corner IDs, half-edges, face loops, materials, normals, positions | `triangulation.test.ts` | snapshot equal after unwrap |
| Shared spatial vertex, multiple corner UVs | `mapping.test.ts` | unique UV count > 1 at a cube vertex |
| xatlas xref + triangle count; no editable vertex from output | `backend.test.ts`, spike, `triangulation.test.ts` | xref in range; `mesh.vertices.size` unchanged |

## Conversion

| Case | Test | Gate |
| --- | --- | --- |
| One finite UV per targeted corner | `convert.test.ts` (identity mock atlas) | `assigned.size === corners` |
| Conflict on same `CornerId` | `convert.test.ts` | `conflicting-corner-uv`, no averaging |
| Non-finite UV | `failures.test.ts` mock | mesh UVs unchanged |
| Unselected byte-stable | `selection.test.ts` | `corner.uv` reference identity |

## Atlas / packing (real xatlas)

| Case | Test | Gate |
| --- | --- | --- |
| Finite normalized UVs, nonzero atlas | meshes + backend | width/height > 0, no NaN |
| Islands reconstructed | meshes | `islands.length > 0` |
| Resolution/padding options | backend + runtime | passed through to watlas |

## Seams and selection

| Case | Test | Gate |
| --- | --- | --- |
| Boundary + discontinuity vs continuous | `seams.test.ts` | interior seam only when ΔUV > `UV_SEAM_TOLERANCE` |
| Channel-local seams | `seams.test.ts` | lightmap flags false |
| Island flood terminates | `seams.test.ts` | 1 island with no interior seams; 2 when all edges seamed |
| Other UV channels | `selection.test.ts` | lightmap UVs unchanged |
| Unselected faces + selection-boundary charts | `selection.test.ts` | previous UVs equal; shared edges in `seamEdgeIds`; overlap warning |
| Pinned reject / ignore | `selection.test.ts` | `pinned-uv` + `cornerIds`; ignore warns and keeps pin |

## History and failures

| Case | Test | Gate |
| --- | --- | --- |
| Execute / undo / redo, pins, UV/seam revision | `packages/commands/tests/automatic-unwrap.test.ts` | before/after restored; pins stay |
| Serialization | `history.test.ts` | round trip |
| Projections still work | `history.test.ts`, `uv.test.ts` | box/planar/smart unchanged |
| Empty mesh, NaN position, unsupported flags | `failures.test.ts` | `empty-mesh` / `UvUnwrapError` / `unsupported-option` |
| Cancellation | `failures.test.ts`, `atlas-lifecycle.test.ts` | `cancelled`; mesh unchanged; later unwrap works |
| Backend / conversion / validation failure | `failures.test.ts` mocks | no partial patch |
| Apply rollback | `failures.test.ts` | seam throw restores UVs |
| Prepare failure | commands test mock | no unwrap history entry |
| Dispose after use | `backend.test.ts` | `disposed` |

## WASM lifecycle (real xatlas unless noted)

| Case | Test | Gate |
| --- | --- | --- |
| Shared initialize + repeat unwrap | `atlas-lifecycle.test.ts`, `backend.test.ts` | two `initialize()`; second unwrap after cancel |
| Atlas `delete()` success and failure | `atlas-lifecycle.test.ts` fake Atlas | `delete()` always called |
| Lazy / unused | `runtime.test.ts` | dispose before initialize → `disposed`, no WASM |
| Worker dispose | `runtime.test.ts` | `unwrapUvAsync` after `pool.dispose()` rejects |

## Runtime / packaging

| Case | Test | Gate |
| --- | --- | --- |
| Node import without WASM | `runtime.test.ts` | `automaticUnwrap` is a function; no `window` |
| Inline worker pool | `runtime.test.ts`, `packages/workers/tests/unwrap-uv.test.ts` | typed-array unwrap |
| worker_threads WASM | spike worker | cube atlas |
| Vite/React/Vue import | `apps/example-react/src/unwrap-consumer.ts`, `apps/example-vue/src/unwrap-consumer.ts` | `pnpm examples:typecheck` |
| Packed tarball unwrap | `scripts/pack-verify.ts` | fixture calls `automaticUnwrap` |

## Spike

`packages/uv/tests/xatlas-integration.spike.test.ts` and `docs/investigations/XATLAS-INTEGRATION-SPIKE.md`.
