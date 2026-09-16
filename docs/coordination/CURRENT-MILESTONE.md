# Current milestone

**Milestone:** Release 1.0 non-deferred matrix closed  
**Rule:** Finish requirements with behavior + tests + evidence. Do not mark VERIFIED without a recorded passing command.

**Source of truth:** `docs/architecture/modeling-operator-specification.md`  
**Evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`

## Just finished

Worker package split (`@modeling-kit/workers`, `/browser`, `/node`), packed-consumer `pack:verify`, MIT publication metadata, host-owned compute pools (removed unsafe `defaultComputePool`), `FluentEditor.dispose()`, and AI `save_scene`.

## Next

Out of 1.0: RIG-001, ANIM-001, BOOL-001, GPU-PICK-001, LSCM/ABF. Remaining before npm publish: tagged release workflow.

## Last gate

```text
pnpm test          # 56 files, 410 tests (workers + mesh bevel invariant)
pnpm typecheck     # packages passed
pnpm examples:typecheck
pnpm lint          # eslint . exit 0
pnpm build         # packages/* tsup passed
pnpm test:dist     # compiled Node worker_threads
pnpm arch:check    # 376 modules, no violations
pnpm pack:verify   # 23 packages, 11 fixture imports
```
