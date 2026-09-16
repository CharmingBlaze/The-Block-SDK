# SDK hardening status

**Date:** 2026-09-16  
**Scope of this pass:** Automatic chart unwrap (`@modeling-kit/uv`, commands, workers).  
**Not in this pass:** UV editor god-file splits, exact LSCM/ABF++, rigging, animation, booleans.

Roadmap narrative: [`docs/roadmap.md`](../roadmap.md) (historical). Release evidence: [`docs/verification/RELEASE-1.0-EVIDENCE.md`](../verification/RELEASE-1.0-EVIDENCE.md). Unwrap architecture: [`docs/architecture/AUTOMATIC-UV-UNWRAP.md`](../architecture/AUTOMATIC-UV-UNWRAP.md).

## Automatic chart unwrap

| Item | Status | Notes |
| --- | --- | --- |
| Canonical topology preserved | CLOSED | IDs, half-edges, loops, materials, normals, non-target channels. Skin maps stay valid via stable vertex IDs. |
| Temporary triangulation → `CornerId` | CLOSED | `triangulatePolygon`; xatlas vertices are not editable. |
| Conversion without averaging | CLOSED | Conflict throws `conflicting-corner-uv`. Texel normalize + V-up documented. |
| Seams / islands | CLOSED | Boundary + discontinuity; channel-local; flood uses remaining-face set. |
| Selected-face unwrap | CLOSED | Unselected UV storage byte-stable; overlap warning; boundary charts. |
| Pin policy | CLOSED | Default reject with `cornerIds`. `ignorePins` warns and keeps pins. |
| Command atomicity | CLOSED | Prepare is apply-free. Apply/command restore snapshots on throw. Undo/redo UV+seam+pin. |
| WASM lifecycle | CLOSED | Lazy init, shared promise, `atlas.delete()` in `finally`, repeat unwrap, pool dispose. |
| Packaging | PARTIAL | Packed Node `automaticUnwrap` in `pack:verify`. Vite/React/Vue compile-import only. No headed browser WASM job. |
| Exact LSCM / ABF++ | OUT OF SCOPE | Feature name is automatic chart unwrap. |

## Remaining limitations

- watlas 1.0.1 cannot take seam-edge constraints or cancel `generate()`.
- `parameterizeUvCharts` is a no-op; `packUvCharts` re-runs generate.
- Chart packing may rotate islands; V-up is atlas texel space after normalization.
- WASM module cannot be unloaded (`Uninitialize` does not exist).
- UV editor files (`editor.ts`, `selection.ts`, `topology.ts`) were not split in this task.
- `arch:check` reports one warning: `session-unwrap.ts` ↔ `session.ts` type/value cycle. Zero errors.

## Gates

Recorded 2026-09-16 from a clean `dist` (`pnpm clean:dist` then build, with later formats/sdk rebuilds after type fixes):

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass (24 packages) |
| `pnpm --filter @modeling-kit/uv typecheck` | pass |
| `pnpm --filter @modeling-kit/uv test` | 14 files, **71** tests passed |
| `pnpm --filter @modeling-kit/commands typecheck` | pass |
| `pnpm --filter @modeling-kit/workers typecheck` | pass |
| `pnpm --filter @modeling-kit/sdk typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | 104 files, **660** tests passed |
| `pnpm build` | pass (24 packages) |
| `pnpm arch:check` | pass (0 errors, 1 warning) |
| `pnpm pack:verify` | pass (24 packages, 14 fixture imports, including `@modeling-kit/uv#automatic-unwrap`) |
| `pnpm examples:typecheck` | pass |
| `pnpm test:dist` | 3 tests passed |
| `pnpm release:check` | pass (24 packages at 0.1.0) |

The requested unwrap gate list passed. `pnpm check:release` constituents also passed: workspace `typecheck`, `examples:typecheck`, `lint`, `test`, `build`, `test:dist`, `arch:check`, `pack:verify`, and `release:check`.
