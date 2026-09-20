# Dependencies & Runtime: modeling-kit

> Generated automatically by **Async IDE Living Repo Wiki**.

## Production Dependencies
No production dependencies listed.

## Development Dependencies
| Package | Version |
|---|---|
| `@changesets/cli` | `3.0.3` |
| `@eslint/js` | `^9.35.0` |
| `@types/node` | `^24.5.2` |
| `dependency-cruiser` | `18.3.0` |
| `eslint` | `^9.35.0` |
| `fast-check` | `4.10.0` |
| `knip` | `6.35.1` |
| `prettier` | `^3.6.2` |
| `@playwright/test` | `^1.55.0` |
| `repomix` | `1.18.0` |
| `tsup` | `^8.5.0` |
| `tsx` | `4.23.13` |
| `typescript` | `^5.9.2` |
| `typescript-eslint` | `^8.44.0` |
| `vitest` | `^3.2.4` |

## Available Scripts
| Script | Command |
|---|---|
| `npm run build` | `pnpm -r --filter "./packages/*" build` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run test:properties` | `vitest run packages/mesh/tests/properties` |
| `npm run test:bench` | `vitest run --config vitest.benchmark.config.ts` |
| `npm run bench:triangulation` | `node --expose-gc --import tsx scripts/bench/triangulation/run.ts` |
| `npm run typecheck` | `pnpm -r --filter "./packages/*" typecheck` |
| `npm run examples:typecheck` | `pnpm -r --filter "./apps/*" typecheck` |
| `npm run lint` | `eslint .` |
| `npm run format` | `prettier --write .` |
| `npm run repo:map` | `tsx scripts/generate-repo-map.ts && tsx scripts/generate-package-graph.ts` |
| `npm run repo:api` | `tsx scripts/generate-public-api-index.ts` |
| `npm run repo:tests` | `tsx scripts/generate-test-index.ts` |
| `npm run repo:indexes` | `pnpm repo:map && pnpm repo:api && pnpm repo:tests` |
| `npm run repo:context` | `tsx scripts/generate-agent-context.ts` |
| `npm run arch:check` | `depcruise packages --config .dependency-cruiser.cjs` |
| `npm run deadcode` | `knip --no-exit-code` |
| `npm run deadcode:files` | `tsx scripts/knip-files-gate.ts` |
| `npm run deadcode:gate` | `knip --include dependencies,duplicates && pnpm deadcode:files` |
| `npm run clean:dist` | `tsx scripts/clean-dist.ts` |
| `npm run check:changed` | `tsx scripts/check-changed-packages.ts` |
| `npm run check:agent` | `tsx scripts/check-agent-task.ts` |
| `npm run pack:verify` | `tsx scripts/pack-verify.ts` |
| `npm run sync:metadata` | `tsx scripts/sync-package-metadata.ts` |
| `npm run test:dist` | `vitest run --config vitest.dist.config.ts` |
| `npm run test:webgl` | `playwright test` |
| `npm run changeset` | `changeset` |
| `npm run version-packages` | `changeset version` |
| `npm run release:check` | `tsx scripts/verify-release-tag.ts` |
| `npm run release:publish` | `pnpm -r --filter "./packages/*" publish --access public --no-git-checks` |
| `npm run check:release` | `pnpm clean:dist && pnpm typecheck && pnpm examples:typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:dist && pnpm arch:check && pnpm pack:verify && pnpm release:check && pnpm deadcode:gate` |