# Contributing

The Block SDK (`@modeling-kit/*`) is a clean-room TypeScript SDK. The private workspace package is `modeling-kit`. Implementation follows first-principles computational geometry and open format specifications. Do **not** inspect, copy, or adapt Blockbench (GPL-3.0) source, comments, or UI.

## Requirements

- Node.js 22 or newer (pnpm 11.7, Changesets, and dependency-cruiser all require Node 22; do not add a Node 20 CI job until that toolchain changes)
- pnpm 11 (`packageManager` in the repo root)
- Windows, macOS, or Linux

```bash
pnpm install
pnpm run build
pnpm test
pnpm typecheck
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Vitest unit/integration suite |
| `pnpm typecheck` | `tsc --noEmit` on `packages/*` |
| `pnpm examples:typecheck` | App TypeScript |
| `pnpm lint` | ESLint |
| `pnpm build` | tsup ESM + `.d.ts` for packages |
| `pnpm test:dist` | Compiled Node `worker_threads` |
| `pnpm arch:check` | dependency-cruiser (no illegal `three` / DOM imports) |
| `pnpm pack:verify` | Packed tarball + fixture imports |
| `pnpm test:webgl` | Playwright WebGL smoke |
| `pnpm check:release` | Full release gate |
| `pnpm repo:indexes` | Refresh generated maps (do not edit `generated/` by hand) |

Do not mark a requirement `VERIFIED` without a recorded passing command in `docs/verification/RELEASE-1.0-EVIDENCE.md`.

## Architecture rules

1. **Three.js boundary.** `three` is a peer of `@modeling-kit/three-adapter` and host apps. Headless packages must not import `three` or DOM types.
2. **Source of truth.** `ModelDocument` + `@modeling-kit/mesh`. Render buffers are derived.
3. **Branded IDs.** `DocumentId`, `ObjectId`, `MeshId`, `VertexId`, `EdgeId`, `FaceId`, … Never persist GPU indices.
4. **Commands.** Persistent edits go through `@modeling-kit/commands`. Topology undo uses snapshots/patches, not floating-point inverses.
5. **Transient previews.** Pointer drags update session state; one history command on release. Canceled drags commit zero commands.
6. **Formats.** Native JSON, glTF/GLB, OBJ, STL, PPM only. No Minecraft, `.bbmodel`, OptiFine, GeckoLib, or MoLang.

Policy: [`../architecture/dependency-policy.md`](../architecture/dependency-policy.md), [`../research/clean-room-rules.md`](../research/clean-room-rules.md). Log new third-party deps in [`../research/provenance-log.md`](../research/provenance-log.md).

## Documentation

- Host-facing guides live under `docs/guides/`.
- Architecture and requirement IDs live under `docs/architecture/`.
- The index is [`../README.md`](../README.md).
- If you add a public API, update the matching guide and run `pnpm repo:api`.

## Agent workflow

Cursor owns architecture, review, and integration. Antigravity owns one bounded task packet at a time. See [`.cursor/rules/agent-workflow.mdc`](../../.cursor/rules/agent-workflow.mdc) and [`../coordination/TASK-BOARD.md`](../coordination/TASK-BOARD.md).

## Publishing

Packages are MIT. First public version is `0.1.0`. Do not publish from a laptop except as a documented recovery. See [Publishing](publishing.md).
