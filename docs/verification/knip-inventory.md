# Knip inventory

Knip advisory totals are not defects. `pnpm deadcode:gate` still fails only on unused dependencies and duplicate exports. Unused files are classified here so a new file in the unused-files report is a real leak.

## Classification

| Class | Meaning |
| --- | --- |
| `public` | Supported package export. Wired through `src/index.ts`. |
| `shim` | Compatibility re-export. Kept only while a caller still imports that path. |
| `entrypoint` | Secondary package entry (`ai.ts`, `three.ts`, workers). Configured in `knip.json` `entry`. |
| `internal` | Helper kept for intra-package use or upcoming tests. Listed in `knip.json` `ignoreIssues`. |
| `orphan` | Nothing imported it. Deleted in the 2026-09-16 re-audit follow-up. |

## Unused files (after follow-up)

The unused-files report is empty. `pnpm deadcode:files` fails if a new unused file appears.

`packages/formats/src/gltf/validation/validate-roundtrip.ts` is an **internal** helper ignored in `knip.json` until a formats test imports it.

`scripts/bench/**` is ignored for `unlisted` because the triangulation profiler imports workspace packages (`@modeling-kit/mesh`, `@modeling-kit/primitives`) from the repo root, which does not declare those as root `dependencies`.

## Orphans removed

- `packages/document/src/serialization.ts` — duplicate of `serialize.ts`
- `packages/document/src/validate.ts` — duplicate of `validation.ts`
- `packages/formats/src/gltf/index.ts` — unused barrel; `formats/src/gltf.ts` is the export
- `packages/formats/src/gltf/import/import-sampler.ts` — duplicate of `import-texture.ts` sampler path
- `packages/formats/src/gltf/conversion/coordinates.ts` — unused identity passthrough
- `packages/primitives/src/source/index.ts` — unused barrel; `from-cells.ts` is imported directly
- `packages/animation/src/model/track.ts` — unused type re-export

## Public API promoted

`keyframe`, `marker`, and `isLooping` are exported from `@modeling-kit/animation`.

## Unused exports and types

103 unused exports and 145 unused exported types are almost all **internal** helpers re-exported from non-entry files (`operations/index.ts`, `sub-element/index.ts`, parameter interfaces). Public supported API is the `src/index.ts!` entries. Do not treat those Knip totals as a deletion list. New **unused files** are the actionable signal.
