# Current milestone

**Milestone:** Release 1.0 non-deferred matrix closed  
**Rule:** Finish requirements with behavior + tests + evidence. Do not mark VERIFIED without a recorded passing command.

**Source of truth:** `docs/architecture/modeling-operator-specification.md`  
**Evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`

## Just finished

Library integrations (predicates, primitive-geometry, earcut, geometry-extrude, meshopt). Public ingest stays split: catalog generators, `convertSimplicialComplex` for recipe libraries, `@modeling-kit/formats` for glTF/OBJ/STL. Packed-cell IR is not on `@modeling-kit/sdk`. Worker package split and MIT publication metadata remain.

## Next

Tagged release workflow is in repo (`.github/workflows/release.yml`). Remaining before npm exists: add GitHub secret `NPM_TOKEN`, then `git tag v0.1.0 && git push origin v0.1.0`. See `docs/guides/publishing.md`. Host documentation index: `docs/README.md`.

Out of 1.0: BOOL-001, LSCM/ABF, and preview-only rigging/animation **authoring** (IK, weight painting, NLA). Canonical skeleton/skin/clip data, evaluation, and glTF skins/animations/textures are stable interchange targets (see `docs/architecture/GLTF-PIPELINE.md`). GPU hover and advanced transparency/instancing stay 1.1.

## Last gate

```text
pnpm check:release      # exit 0 (~113s) after knip optional-peer ignore
pnpm typecheck          # packages passed; @modeling-kit/formats mapped for clean clones
pnpm examples:typecheck # example-react, example-vue, geometry-gallery, playground, scratch-host, webgl-smoke
pnpm lint               # eslint . exit 0
pnpm test               # 114 files, 690 tests (benches are pnpm test:bench)
pnpm build              # packages/* tsup passed
pnpm test:dist          # 1 file, 3 tests (compiled Node worker_threads)
pnpm arch:check         # 742 modules, 2816 dependencies, no violations
pnpm pack:verify        # 24 packages, 14 fixture imports
pnpm release:check      # 24 packages at 0.1.0 (no tag required locally)
pnpm deadcode:gate      # unused deps + duplicate exports; sdk/three is a knip entry
pnpm test:webgl         # 1 passed (real WebGL GPU picking smoke)
```
