# Current milestone

**Milestone:** Release 1.0 non-deferred matrix closed  
**Rule:** Finish requirements with behavior + tests + evidence. Do not mark VERIFIED without a recorded passing command.

**Source of truth:** `docs/architecture/modeling-operator-specification.md`  
**Evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`

## Just finished

Re-audit 0.1 follow-ups on `main`. Recorded this pass: `pnpm test` **115 files / 705 tests**; `pnpm typecheck` 24 packages; `pnpm lint` exit 0; `pnpm deadcode:gate` exit 0.

Audit-repair `e8233db` on `main`. GitHub Actions [run 35060344278](https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35060344278) succeeded: `verify` (`pnpm check:release`), `clean-typecheck`, `webgl-smoke`. Packed export-path checks landed in `a88debc`.

## Next

Remaining before npm exists: add GitHub secret `NPM_TOKEN`, then `git tag v0.1.0 && git push origin v0.1.0`. See `docs/guides/publishing.md`. Do not tag until the secret exists — the same version cannot be republished.

Out of 1.0: BOOL-001, LSCM/ABF, and preview-only rigging/animation **authoring** (IK, weight painting, NLA). Canonical skeleton/skin/clip data, evaluation, and glTF skins/animations/textures are stable interchange targets (see `docs/architecture/GLTF-PIPELINE.md`). GPU hover and advanced transparency/instancing stay 1.1. Engines stay Node 22 until a Node 20 CI job proves otherwise. Triangle `three-mesh-bvh` stays 1.1; object AABB BVH is in 1.0.

## Last gate

```text
pnpm test               # 115 files, 705 tests (benches are pnpm test:bench)
pnpm typecheck          # 24 packages
pnpm lint               # eslint . exit 0
pnpm deadcode:gate      # unused deps + duplicates + unused-files allowlist
# Last full check:release + CI: e8233db https://github.com/CharmingBlaze/The-Block-SDK/actions/runs/35060344278
# pnpm check:release      # exit 0 on e8233db (~113s)
# pnpm pack:verify        # 24 packages, 14 fixture imports (e8233db / a88debc packing rules)
# pnpm test:webgl         # 1 passed
```
