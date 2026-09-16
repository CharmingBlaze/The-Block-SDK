# Release 1.0 milestone plan (priority order)

**Status (2026-09-16):** Non-deferred 1.0 requirement rows are `VERIFIED` in `docs/verification/RELEASE-1.0-EVIDENCE.md`. This table is the historical work order, not a second tracker. Remaining before npm: `NPM_TOKEN` + `v0.1.0` tag. Host docs: `docs/README.md`.

| Milestone | Work-order steps | Exit criteria | First tasks |
| --------- | ---------------- | ------------- | ----------- |
| **M0** Audit | — | Spec IDs, evidence matrix, freeze, boundaries | Done 2026-09-15 |
| **M1** Kernel elements + selection + command remap | 3–4 | MESH-005, MESH-OP-019–022, SEL-001–003, CMD-004–005, SEL-006 PARTIAL→VERIFIED | R1-T001, R1-T002, R1-T003 |
| **M2** Remaining foundational ops | 3 | dissolve vertex/face, collapse edge, reverse winding, cleanup completeness | R1-T004 |
| **M3** Transform machine + snap service | 5 | XF-002, SNAP-001; knife uses SnapQuery | R1-T005, R1-T006 |
| **M4** Headless sdk split + registries | 1, 19 | ARCH-003, EXT-001 | R1-T007, R1-T008 (Cursor) |
| **M5** Capabilities | 19 | EXT-002 | R1-T009 |
| **M6** PrimitiveType unification + primitive evidence | 6 | PRIM-001–018 VERIFIED | R1-T010 |
| **M7** Operator hardening | 3 | inset concave, bevel chains, loop-cut documented limits | R1-T011, R1-T012 |
| **M8** Viewport naming + optional BVH interface | 7 | VP-003 docs; VP-005 only if approved | Done (GPU click in 1.0; first-party AABB BVH with revision-aware rebuild; `three-mesh-bvh` still optional) |
| **M9** Materials/UV/paint evidence upgrade | 8–11 | Promote PARTIAL→VERIFIED with invariant tests; no new parallel systems | Done in evidence matrix |
| **M10** Formats reports + STL import decision | 12 | FMT-001–004 | Done (ASCII STL import/export; reports on glTF) |
| **M11** AI/docs/examples CI | 13 | AI-001, DX-001 | Done (AI tools + example typecheck in `check:release`) |
| **M12** Perf/lifecycle release gate | 14 | LIFE-*, PERF-001, full `pnpm test && pnpm typecheck && pnpm build` | Done (`pnpm check:release`) |

**Deferred from 1.0:** RIG-001, ANIM-001, BOOL-001. GPU-PICK-001 click path is in 1.0; GPU hover / transparency / InstancedMesh / GPU skinning remain 1.1 (see spec §5.12).

## Integration gate after M1

```text
pnpm exec vitest run packages/mesh/tests/elements.test.ts packages/mesh/tests/operations.test.ts packages/mesh/tests/mesh.test.ts
pnpm exec vitest run packages/selection/tests
pnpm exec vitest run packages/commands/tests/commands.test.ts
pnpm test
pnpm typecheck
```

If `pnpm typecheck` is not yet recorded, M1 cannot mark requirements `VERIFIED`.
