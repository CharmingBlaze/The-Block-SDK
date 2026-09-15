# Current milestone

**Milestone:** Release 1.0 non-deferred matrix closed  
**Rule:** Finish requirements with behavior + tests + evidence. Do not mark VERIFIED without a recorded passing command.

**Source of truth:** `docs/architecture/modeling-operator-specification.md`  
**Evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`

## Just finished

Material dual-field sync (`syncMaterialDualFields`): `baseColor`/`color`, `emissive`/`emissiveColor`, and `textureBindings` vs `*Texture` stay equal on create and update. Full 1.0 gates recorded earlier this session (`pnpm test` 55/355, typecheck, lint, build, arch:check).

## Next

Out of 1.0: RIG-001, ANIM-001, BOOL-001, GPU-PICK-001, LSCM/ABF.

## Last gate

```text
pnpm test          # 55 files, 355 tests
pnpm typecheck     # packages passed
pnpm lint          # eslint . exit 0
pnpm build         # packages/* tsup passed
pnpm arch:check    # 355 modules, no violations
```
