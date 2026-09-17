# The Block SDK — 1.1 capability plan

Sized against the working tree, not against aspiration. Every "already exists"
claim below was verified by reading the export surface or `git grep`.

## 0. Measured baseline (this tree)

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | **exit 0**, 24 packages |
| `pnpm test` | **120 files / 783 tests passed**, 24.0 s |
| Recorded evidence (`CURRENT-MILESTONE.md`) | 115 files / 705 tests at `5a3d941` |
| Delta | the working tree adds **5 test files / 78 tests** |

**The working tree is dirty and load-bearing.** 63 paths changed,
+1836 / −209, plus ~15 untracked new source files. Sol3D already imports several
of them (`viewport-display-controller.ts`, `pixel-tools.ts`,
`paint-uv-layout.ts`, `primitive-creation.ts`, `viewport-gesture-controller.ts`,
`orbit-event-gate.ts`, `viewport-pointer-router.ts`). CI, `check:release`, and
`pack:verify` have never seen any of it. Treat committing that work as the
first item on this list.

## 1. Already shipped — do not rebuild

These were assumed missing by the 1.1 ask and are not:

- **AI drivability.** `@modeling-kit/sdk/ai` exposes OpenAI-style function schemas,
  argument validation via `ai-schema`, **structured failures** (`code`, `field`,
  `issues`, `retryable`), **idempotency keys** (`issue_request_id` +
  `clientRequestId`, cached replay), **transactions**
  (`begin`/`commit`/`rollback_transaction`), and a scene `inspection` attached to
  every result. This is the strongest part of the SDK. Extend it; don't replace it.
- **Subdivision + creases.** `subdivideFaces` and crease support are in `mesh`
  (`SIMPLE-CREASES.md`, `SIMPLE-BEVEL-MITERS.md`).
- **Rigging data + math.** `skeleton/`, `skin/`, `evaluation/`: automatic nearest
  and rigid weights, `normalizeWeights` + `normalizeWeightsWithReport`,
  `mirrorWeightBones`, `copyWeights`, `remapWeights`, bone-influence handling,
  `validateWeights` / `validateSkinBinding` / `validateInverseBindMatrices`,
  `evaluateSkinMatrices`, `skinPositions` (linear blend skinning).
- **Animation.** clip/track/keyframe/marker, interpolation, loop policy,
  `player`, binding validation, glTF track mapping.
- **UV.** `unwrap/backend/` with a **registry** and an xatlas backend, seams,
  charts, islands, pins, distortion, overlap, discontinuity, packing, projection,
  editor session, selection, interaction.
- **Paint.** `engine`, `rasterizer`, `TextureBuffer`, `dilate`, `pixel-tools`,
  `paint-3d` (surface hits), `paint-uv-layout`, `uv-mapper`, mirror-X support.
- **Perf.** `MeshLocalBvh` (rebuild on topology revision, refit on position
  revision), object-AABB BVH, triangulation fast path, `meshopt` on derived
  triangles only.
- **Primitives.** 32 types through the AI surface; a primitive-creation module.
- **Interchange.** glTF/GLB, OBJ, STL (ascii + report), native JSON.

## 2. Verified gaps

Confirmed absent by search over all `packages/*/src`:

| Gap | Evidence | Notes |
| --- | --- | --- |
| Boolean CSG | 0 hits for `boolean(Union|Subtract|Intersect|Difference)`, `carve`, `bsp`, `weldIntersections` | `BOOL-001`, already in the 1.1 backlog |
| LSCM / ABF unwrap | 0 hits for `lscm`, `abf`, `angleBased`, `conformal` | Slots straight into `unwrap/backend/registry` |
| Weight painting | 0 hits for `paintWeight`, `smoothWeight`, `brushFalloff` | **Math is in rigging**; missing is brush application over vertices + falloff + smooth/dilate |
| IK / joint limits | 0 hits for `inverseKinematics`, `jointLimit` | Needs new `rigging` module + constraints on pose eval |
| Morph targets / blend shapes | 0 hits for `morphTarget`, `blendShape` | Touches document schema + glTF morph export |
| Mirror **modelling operator** | only hit is an assert message | Paint has mirror-X; mesh has no mirror-and-weld op |
| NLA / clip mixing | 0 hits for `nla`, `additiveClip`, `mixer` | |
| PLY codec | 0 hits | Trivial, good starter packet |
| GPU hover / instanced picking | `InstancedMesh` used for edge/vertex **visualization** only | Listed as 1.1 |


## 3. Sequenced plan

Ordered by (user-visible capability) ÷ (risk to the 1.0 evidence base). Each row
is a packet with its own tests; nothing here is a refactor-in-disguise.

### P0 — Protect the tree before anything else

| # | Item | Why first |
| --- | --- | --- |
| P0.1 | Commit the 63-path / +1836 working set in reviewable commits | Sol3D imports these files. They exist on one machine, unbacked by CI. |
| P0.2 | Run `pnpm check:release` + `pack:verify` on it, record in `RELEASE-1.0-EVIDENCE.md` | The repo's own rule: no `VERIFIED` without a recorded passing command. |
| P0.3 | Add `NPM_TOKEN`, tag `v0.1.0` | Unblocks publish; everything after this is 0.1.x/1.1 with a real version floor. |

### P1 — Small, high-leverage, low-risk (start here)

| # | Capability | Package(s) | Sketch |
| --- | --- | --- | --- |
| P1.1 | **PLY codec** | `formats` | Reader + writer + report, mirroring the existing OBJ/STL shape. Self-contained, no kernel risk. |
| P1.2 | **Mirror modelling operator** | `mesh`, `commands` | `mirrorAndWeld(axis, tolerance)`: clone, flip winding, translate, weld coincident boundary via the existing merge machinery. Paint has mirror-X; mesh has no mirror operator. |
| P1.3 | **Weight painting primitives** | `rigging` | `paintVertexWeights(mesh, hits, {bone, strength, falloff, mode: add\|replace\|smooth})` plus `smoothWeights` / `dilateWeights` / `pruneWeights`, each returning a report like `normalizeWeightsWithReport`. The data model, `normalizeWeights`, `mirrorWeightBones` and `validateWeights` already exist — only brush application is missing. |
| P1.4 | **AI tool parity** | `sdk/ai` | Expose P1.2/P1.3 as tools with schemas + structured errors. Every capability must be agent-reachable or it does not count. |

### P2 — Real algorithm work

| # | Capability | Package(s) | Notes |
| --- | --- | --- | --- |
| P2.1 | **LSCM unwrap** | `uv/unwrap/backend` | Slots into the existing backend **registry** plus the `distortion`/`validate` machinery. Needs a sparse linear solve; choose `glpk` / `ml-matrix` / hand-rolled against `dependency-policy.md` **before** writing code. |
| P2.2 | **ABF++** | `uv/unwrap/backend` | Lower angle distortion than LSCM; same registry slot. Do after LSCM so solver and tests are shared. |
| P2.3 | **Boolean CSG** (`BOOL-001`) | `mesh` or new `@modeling-kit/csg` | Biggest item. Clean-room + licence check for any helper (`manifold-3d`, `carve2`, `three-bvh-csg`) under `dependency-policy.md` and `provenance-log.md`, then decide whether output is canonical half-edge or derived triangles. Recommend derived-triangles-first, as `meshopt` does, to keep the kernel untouched. |
| P2.4 | **IK + joint limits** | `rigging`, `animation` | CCD/FABRIK over the existing hierarchy and `PoseMap`; limits as per-bone cones in the document schema. |
| P2.5 | **Clip mixing / layers** | `animation` | Weighted blend of two evaluated poses plus an additive layer; builds on `evaluateClip` and `loop-policy`. |

### P3 — Adapter and UX surface

| # | Capability | Package(s) |
| --- | --- | --- |
| P3.1 | GPU hover picking + `InstancedMesh` picking | `three-adapter` (already 1.1 in the spec) |
| P3.2 | Morph-target / blend-shape evaluation + glTF export | `document`, `rigging`, `formats` |
| P3.3 | Push app-side pixel layers down into the SDK | `paint` — Sol3D currently implements layer compositing, ellipse, and clone-stamp in app code (`src/workspaces/pixel/`). Moving them into `@modeling-kit/paint` makes them available to every host and to the AI tool surface. |
| P3.4 | Weight-paint viewport overlay | `three-adapter` — per-bone vertex-colour weight preview |

## 4. Why the plan is shaped this way

The ask assumed the SDK needed foundational work in UV, painting, rigging, and
animation. It does not — each already has a real package, tests, and docs. What
it lacks is the **authoring layer** on top of correct data models: weight
*painting* (not weight storage), conformal unwrapping (not unwrapping), booleans
(not mesh ops), IK (not pose evaluation).

So the highest-value work is narrow algorithmic additions into existing
extension points — `unwrap/backend/registry`, `rigging/skin`, `formats`,
`sdk/ai` — not restructuring. P0 comes first because 1836 lines of
load-bearing uncommitted work is a larger risk to this project than any missing
feature.

## 5. Rules this plan obeys

- New dependencies only after a clean-room and licence check (`docs/research/`).
- The mesh kernel is not mutated by CSG or simplification; derived triangles only.
- Every capability lands as command + AI tool + test + doc, or it stays in backlog.
- `VERIFIED` only with a recorded passing command.
- One packet per `tasks/<ID>.md`; update `TASK-BOARD.md` on every state change.
