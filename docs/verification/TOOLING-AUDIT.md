# Tooling audit

**Date:** 2026-09-15  
**Node:** v26.3.0  
**Package manager:** pnpm@11.7.0  
**Spec:** `docs/architecture/modeling-operator-specification.md`  
**Release 1.0:** not complete.

This document is the Phase 1–10 record for agent-context tooling. It does not replace the operator specification.

## Audit table

| Capability | Existing tool | Configuration | Working | Missing | Recommendation |
| --- | --- | --- | ---: | ---: | --- |
| Semantic code retrieval | none (Cursor grep/read only) | — | no | Serena MCP | Added project MCP + read-only `.serena/project.yml`. Enable in Cursor. |
| AI context packing | none | — | no | Repomix | Added `repomix.config.json` + `pnpm repo:context -- --preset <name>`. Output gitignored. |
| Package-boundary enforcement | prose in `docs/architecture/dependency-policy.md` / `docs/coordination/PACKAGE-BOUNDARIES.md` | no machine gate | docs only | dependency-cruiser | Added `.dependency-cruiser.cjs` + `pnpm arch:check`. |
| Dead-code detection | ESLint unused-vars (file-local) | `eslint.config.js` | partial | Knip | Added `knip.json` + `pnpm deadcode` (report-only, `--no-exit-code`). |
| Property testing | Vitest example tests | `vitest.config.ts` | unit only | fast-check | Added root devDependency + `packages/mesh/tests/split-edge.property.test.ts`. |
| Public API tracking | none | — | no | generated index | `pnpm repo:api` → `generated/public-api-index.md`. Do not add api-extractor yet. |
| Documentation generation | hand-written `docs/` | — | yes | TypeDoc | Do not add TypeDoc until public API freeze. |
| Changed-package testing | none (no GitHub Actions) | — | no | helper script | `pnpm check:changed` lists packages from git; no commits yet so it reports the full workspace. |
| Release management | `@changesets/cli` 3.0.3 + tag workflow | `.changeset/config.json`, `.github/workflows/release.yml` | yes | npm org + `NPM_TOKEN` | First publish is `git tag v0.1.0` after the secret exists. |
| Browser integration tests | none | — | no | Playwright | Do not add; viewport tests stay Vitest/jsdom-free Node tests. |
| Agent coordination | `docs/coordination/*`, `tasks/R1-T00x.md` | present | yes | task template + check script | Reused existing board/milestone/freeze/review docs. Added `tasks/TEMPLATE.md` + `pnpm check:agent`. |

## Search results (pre-install)

Present: Vitest, ESLint, Prettier, tsup, TypeScript, pnpm workspaces, `.changeset/config.json`, Cursor rules (`.cursorrules`, `.cursor/rules/modeling-kit.mdc`).

Absent: Serena, Repomix, dependency-cruiser, Knip, fast-check, ast-grep, TypeDoc, api-extractor, Playwright, Turbo, Nx, Lage, Wireit, Husky, lint-staged, commitlint, Renovate, Dependabot, GitHub Actions, MCP config.

## Phase 3 records (installed)

All are root `devDependencies` only. None appear in `packages/*/package.json`. Removal: drop the package and its config/script, then `pnpm install`.

| Tool | Why | Alternative | License | Status | Size | Runtime | Security | Node | Browser | Published packages | Scripts | Removal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Serena MCP | Symbol lookup without whole-file reads | Cursor grep | Apache-2.0 | maintained | not npm | MCP stdio | read-only project; cache gitignored | Python 3 + `uv` | none | none | Cursor MCP | delete `.cursor/mcp.json` + `.serena/` |
| Repomix 1.18.0 | Task-sized packs + token count + secret scan | none | MIT | maintained | npm dev | CLI | `--security-check`; output gitignored | Node 26 ok | none | none | `repo:context` | uninstall + delete `repomix.config.json` |
| dependency-cruiser 18.3.0 | Enforce real package graph | docs only | MIT | maintained | npm dev | CLI | reads source graph only | `^22 \|\| ^24 \|\| >=26` | none | none | `arch:check` | uninstall + delete `.dependency-cruiser.cjs` |
| knip 6.35.1 | Unused files/exports/deps | ESLint unused-vars | ISC | maintained | npm dev | CLI | report-only | Node 26 ok | none | none | `deadcode` | uninstall + delete `knip.json` |
| fast-check 4.10.0 | Shrinkable topology/invalid-input tests | more Vitest cases | MIT | maintained | npm dev | tests | none | Node 26 ok | none | none | `test:properties` | uninstall + delete `*.property.test.ts` |
| tsx 4.23.13 | Run repo scripts without a new TS compile graph | none in repo | MIT | maintained | npm dev | CLI | none | Node 26 ok | none | none | `repo:*`, `check:*` | uninstall if scripts rewritten |

## Deliberately not added

- **Aider** — Serena + generated maps cover repository maps; a second coding agent duplicates Cursor/Antigravity.
- **CrewAI / AutoGPT / general multi-agent frameworks** — Cursor and Antigravity already provide agents.
- **ast-grep** — evaluate later for DOM/`addEventListener` structural rules; import rules belong to dependency-cruiser.
- **TypeDoc / api-extractor / Playwright / Turbo / Nx / Husky / commitlint / Renovate** — overlap or premature. The Changesets CLI is installed for tagged npm publish.

## Configuration locations

| Item | Path |
| --- | --- |
| Serena project (read-only) | `.serena/project.yml` |
| Cursor MCP | `.cursor/mcp.json` |
| Agent token rules | `.cursor/rules/agent-workflow.mdc` |
| dependency-cruiser | `.dependency-cruiser.cjs` |
| Knip | `knip.json` |
| Repomix | `repomix.config.json` + `scripts/generate-agent-context.ts` |
| Changesets | `.changeset/config.json` |
| npm tag publish | `.github/workflows/release.yml` |
| Task template | `tasks/TEMPLATE.md` |
| Indexes | `generated/*.md` (context dumps gitignored) |
| Provenance | `docs/research/provenance-log.md` |

Reused (not duplicated): `docs/coordination/CURRENT-MILESTONE.md`, `TASK-BOARD.md`, `API-FREEZE.md`, `REVIEW-CHECKLIST.md`, `PACKAGE-BOUNDARIES.md`, `docs/verification/RELEASE-1.0-EVIDENCE.md`, `docs/architecture/ownership.md`, `docs/architecture/dependency-policy.md`.

Not created (equivalents exist): `docs/architecture/package-boundaries.md`, `state-and-update-model.md`, `lifecycle-and-resource-ownership.md`.

## Verification results

1. **Serena** — Project config is read-only TypeScript. `uv` 0.12.15 was installed into the user Python environment so Cursor can launch `python -m uv tool run --from git+https://github.com/oraios/serena serena start-mcp-server`. This session does not host the MCP server, so live `find_symbol(splitEdge)` was **not** executed here. After Cursor reloads MCP, ask: find `splitEdge` and its references in `@modeling-kit/mesh`. Do not treat Serena’s index as newer than the working tree.
2. **Repomix mesh preset** — 10 files, **12,559 tokens** (o200k_base), security scan clean. Default budget for that preset is now 15,000.
3. **Exclusions** — Pack contained only `packages/mesh` sources/tests plus cited coordination docs and `tasks/R1-T001.md`. `node_modules`, `dist`, apps, and lockfile excluded. A mention of `three-adapter` appears only as API-freeze prose, not adapter source.
4. **dependency-cruiser probe** — Temporary `packages/mesh/src/_depcruise-probe.ts` importing `three` produced `error no-three-in-headless: packages/mesh/src/_depcruise-probe.ts → three`. Probe deleted. Unresolved `three` in headless packages is matched via `to.path` `^three$` because those packages do not declare the dependency.
5. **Probe removed** — `pnpm arch:check` returns 0 errors (warnings remain; see baseline).
6. **Knip** — Report-only. No files deleted. Baseline below.
7. **fast-check** — `pnpm test:properties` passed (2 tests). Also included in `pnpm test` (268 tests total).
8. **Indexes** — `generated/package-graph.md` lists all 23 `packages/*` names from manifests; `repo-map` matches those names.
9. **check-agent-task** — `packages/commands/src/index.ts` against `tasks/R1-T001.md` → `error: Out of scope`. In-scope mesh files → `ok` (public-entry warning).
10. **typecheck / test / build** — passed. **lint** — still fails on **pre-existing** issues in apps and some packages; new `scripts/` and the property test pass ESLint.
11. **Runtime deps** — new tools are not in any `packages/*/package.json`.
12. **Context dumps** — `generated/context-*` is gitignored. Do not commit packed source.

## Baseline warnings (keep; do not auto-delete)

### dependency-cruiser (`pnpm arch:check`)

- `no-intra-package-circular` — `packages/selection/src/manager.ts` ↔ `topology.ts` (file-level; not a package cycle).
- Headless `@modeling-kit/sdk` (except `src/three.ts`) must not import `three` / `three-adapter` (`no-three-in-headless`, `no-adapter-in-headless`).

### Knip (`pnpm deadcode`)

- Unused files (review later, do not delete now): `packages/document/src/serialization.ts`, `packages/document/src/validate.ts`, `packages/selection/src/types.ts`.
- Unused workspace dependencies listed in several package.json files (commands→snapping, etc.) — may be pending implementation; not a deletion list.
- Many unused *internal* exports and types. Public entries use `src/index.ts!` so package-root exports are treated as used.
- `ignoreIssues` for `packages/**/tests/**` / `unlisted`: tests import sibling packages through Vitest aliases; those are not runtime dependencies. Reason recorded here, not as silent cleanup.

Apps are `ignoreWorkspaces` until their Vite entries are configured.

## Token budget

| Pack | Tokens | Budget |
| --- | ---: | ---: |
| Naive `packages/mesh/**` + core/math/validation + full spec | 95,230 | too large |
| Task-sized `mesh` preset (elements/split-edge + task packet) | **12,559** | 15,000 |

**Recommended maximums**

- Single Antigravity task pack: **15,000 tokens**.
- Cursor review of a vertical slice: **25,000 tokens**.
- Never dump the whole monorepo. Prefer Serena + `generated/repo-map.md` + `generated/public-api-index.md`.
- Use `--compress` only when a pack still exceeds 25k after narrowing files.

## Cursor workflow

1. Read `docs/coordination/CURRENT-MILESTONE.md` and the active `tasks/<ID>.md`.
2. Open only cited spec sections.
3. Use Serena (when connected) then `rg`, then generated indexes.
4. Write/adjust the task packet (allowed files, requirement IDs, verification commands).
5. Optionally `pnpm repo:context -- --preset <name> --budget 15000`.
6. Review Antigravity’s branch/diff with `docs/coordination/REVIEW-CHECKLIST.md`.
7. `pnpm check:agent -- --task tasks/<ID>.md --changed-files …`
8. Independent `vitest` on allowed tests; `pnpm arch:check` if imports changed.
9. Integrate on `integration/release-1` when that branch exists. Update evidence only after confirmation.
10. Discard `generated/context-*`. Start the next task only after overlap checks.

## Antigravity workflow

1. One READY_FOR_ANTIGRAVITY packet. Branch `agent/<TASK-ID>`.
2. Edit only allowed files. No new dependencies, no spec rewrites, no frozen-contract changes.
3. Run the packet’s verification commands.
4. Hand off with the template in `tasks/TEMPLATE.md`.
5. Stop. Do not pick the next task.

## Manual Serena / Cursor MCP setup

1. Ensure `python` and `uv` are on the PATH Cursor uses (`python -m uv --version`).
2. Reload Cursor so `.cursor/mcp.json` is picked up.
3. Approve the Serena MCP server. Confirm tools are read-only (project `read_only: true`).
4. If `python` is not found, point `command` at `%AppData%\Roaming\Python\Python314\Scripts\uvx.exe` (version-specific; avoid unless needed).
5. After large edits, refresh/re-index; do not assume stale symbols.

## Scripts added

```text
pnpm repo:map
pnpm repo:api
pnpm repo:tests
pnpm repo:indexes
pnpm repo:context -- --preset mesh
pnpm arch:check
pnpm deadcode
pnpm test:properties
pnpm check:changed
pnpm check:agent -- --task tasks/R1-T001.md --changed-files <files>
pnpm check:release   # typecheck, lint, test, build, arch:check, pack:verify, release:check
pnpm release:check
pnpm changeset
```
