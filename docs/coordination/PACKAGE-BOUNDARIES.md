# Package dependency and boundary report

**Audit:** 2026-09-15  
**Policy:** `docs/architecture/dependency-policy.md`  
**Declared graph:** `docs/architecture/sdk-architecture.md`

## Declared direction (should)

```text
math
  → core
    → document ← validation (validation also → mesh)
      → mesh
        → scene, selection, materials, uv
          → commands
            → history, transform, snapping, primitives, tools, input
              → rigging, animation, paint, formats, workers
                → three-adapter
                  → sdk
```

`@modeling-kit/scene` depends on `document` (re-export + helpers). `@modeling-kit/history` depends on `document`, `mesh`, `selection`.

## Observed package.json dependencies

| Package | Depends on | Boundary notes |
| ------- | ---------- | -------------- |
| core | none | OK |
| math | (not re-read; no three) | OK |
| document | core, math | OK |
| mesh | core, math | OK |
| validation | core, math, mesh | OK; policy diagram had validation under document — actual is mesh-facing |
| scene | core, document, math | OK |
| selection | core (only) | OK; T002 may depend on mesh |
| history | core, document, mesh, selection | Heavier than “commands ↑ history” sketch |
| materials | (document-facing) | OK if no three |
| uv | mesh | OK |
| paint | core, math, mesh, uv | OK |
| primitives | mesh stack | OK |
| transform | document/scene | OK |
| snapping | math | OK; too small for SNAP-001 |
| input | core, math; export `./dom` | OK split |
| tools | core, math, mesh, input | OK; **re-exports mesh operators** (misplaced API) |
| commands | core, math, document, history, mesh, scene, selection, tools, materials, uv, rigging, animation, transform, snapping, paint, primitives, validation | Wide; depends on **tools** |
| formats | core, math, mesh, document, scene | OK |
| workers | mesh, uv, validation | OK; runtime-neutral entry has no `node:` / `process`; `/browser` and `/node` are explicit |
| rigging / animation | document/mesh | Preview; deferred 1.0 gate |
| three-adapter | commands, core, document, mesh, scene, rigging; **peer three** | OK isolation |
| sdk | headless facade; optional peer three-adapter for `./three` | ARCH-003 |

## Violations and drift

1. **`@modeling-kit/sdk` requires `three-adapter`** — resolved R1-T007 (`@modeling-kit/sdk/three` optional).
2. **`commands` → `tools`** — session/tools coupling; keep tools free of commands (currently true).
3. **`tools` public mesh aliases** — architectural duplication, not a package-cycle.
4. **`validation` → mesh** while some docs imply document-level validation only — both exist (`document/src/validation.ts` vs package).
5. **dependency-cruiser** is configured at `.dependency-cruiser.cjs` (`pnpm arch:check`). **Knip** is report-only (`pnpm deadcode`). Neither is an Antigravity batch-1 implementation task.
6. **history → mesh** — snapshot types; acceptable if commands remain the mutators.

## Headless import scan (targeted)

- `from "three"` appears in `packages/three-adapter` (allowed).
- Headless `package.json` files do not list `three`.
- `PointerEvent` / `HTMLElement` belong in `input/dom` and adapter/viewport only.

## Optional engines

`robust-predicates` is installed in `@modeling-kit/math` only (R1-T013), behind `GeometryPredicates`. `primitive-geometry` is installed in `@modeling-kit/primitives` only (R1-T014), behind `convertSimplicialComplex`. `earcut` is installed in `@modeling-kit/mesh` only (R1-T015), behind `triangulatePolygonLoops`. `geometry-extrude` is installed in `@modeling-kit/primitives` only (R1-T016), behind `generateProfileExtrude`. meshoptimizer, three-mesh-bvh, and manifold-3d remain uninstalled until their adapter tasks.
