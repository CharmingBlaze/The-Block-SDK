# Current milestone

**Milestone:** Release 1.0 non-deferred matrix closed  
**Rule:** Finish requirements with behavior + tests + evidence. Do not mark VERIFIED without a recorded passing command.

**Source of truth:** `docs/architecture/modeling-operator-specification.md`  
**Evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`

## Just finished

Re-audit 0.1 follow-ups on `main` at `5a3d941`. GitHub Actions [run 35063242733](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35063242733) succeeded on that SHA: `verify` (`pnpm check:release`, including `pack:verify`), `clean-typecheck`, `webgl-smoke`.

Local counts on the same tree: `pnpm test` **115 files / 705 tests**; `pnpm typecheck` 24 packages; `pnpm lint` exit 0; `pnpm deadcode:gate` exit 0.

M3/M4 (re-audit leftovers): Node engines stay `>=22` because pnpm 11.7, Changesets, and dependency-cruiser require Node 22. Naming is documented: product **The Block SDK**, npm `@modeling-kit/*`, private root `modeling-kit`. Packages were not renamed.

Prior recorded SHAs: audit-repair `e8233db` ([run 35060344278](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35060344278)); packed export-path checks `a88debc` ([run 35061120304](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35061120304)).

## Next

Remaining before npm exists: add GitHub secret `NPM_TOKEN`, then `git tag v0.1.0 && git push origin v0.1.0`. See `docs/guides/publishing.md`. Do not tag until the secret exists — the same version cannot be republished.

Out of 1.0: BOOL-001, LSCM/ABF, and preview-only rigging/animation **authoring** (IK, weight painting, NLA). Canonical skeleton/skin/clip data, evaluation, and glTF skins/animations/textures are stable interchange targets (see `docs/architecture/GLTF-PIPELINE.md`). GPU hover and advanced transparency/instancing stay 1.1. Engines stay Node 22: pnpm 11.7, `@changesets/cli`, and `dependency-cruiser` require it, so a Node 20 CI job cannot use this toolchain. Triangle `three-mesh-bvh` stays 1.1; object AABB BVH is in 1.0.

**0.1 interactive limits:** derived `triangulateMesh` on ~10k–100k vertex grids is a batch cost, not a pointer-move budget. Object AABB BVH is the 1.0 spatial layer. See `docs/guides/triangulation.md`.

## Last gate

```text
pnpm test               # 115 files, 705 tests (benches are pnpm test:bench)
pnpm typecheck          # 24 packages
pnpm lint               # eslint . exit 0
pnpm deadcode:gate      # unused deps + duplicates + unused-files allowlist
# Last full check:release + CI: 5a3d941 https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35063242733
# pnpm check:release      # exit 0 on 5a3d941 (CI verify job, ~195s)
# pnpm pack:verify        # inside check:release; 24 packages, export+.d.ts packing from a88debc
# pnpm test:webgl         # CI webgl-smoke success on 5a3d941
```
