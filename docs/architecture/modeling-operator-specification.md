# Modeling Operator Architecture & Release 1.0 Specification

**Document role:** This is the only master specification for `@modeling-kit/*` Release 1.0.

**Completion evidence:** `docs/verification/RELEASE-1.0-EVIDENCE.md`  
**Work assignment:** `docs/coordination/` and `tasks/`  
**Package ownership:** `docs/architecture/ownership.md`  
**Dependencies:** `docs/architecture/dependency-policy.md`

Do not create a second competing master specification. Trackers may link here; they must not invent alternate APIs or completion status.

---

## 1. Document roles

| Document | Answers |
| -------- | ------- |
| This specification | What must exist, how it behaves, requirement IDs, acceptance criteria, explicit deferrals |
| `docs/verification/RELEASE-1.0-EVIDENCE.md` | Status, files, tests, commands, blockers |
| `docs/coordination/*` | Current milestone, task board, API freeze, review checklist |
| `docs/architecture/interactive-tools.md` | Tool session machines, preview vs command commit, disposal |
| `docs/roadmap.md` | Historical phase narrative (not completion evidence) |

“100% complete” means every non-deferred requirement is `VERIFIED` in the evidence file. A checkbox, filename, or export is not evidence.

---

## 2. Status vocabulary

Used only in evidence and task files:

| Status | Meaning |
| ------ | ------- |
| `VERIFIED` | Implementation, required tests, and recorded passing commands exist. Headless, undo, serialization, and disposal gates that apply have passed. |
| `PARTIAL` | Real code exists, but behavior, tests, lifecycle, or integration evidence is incomplete. |
| `MISSING` | Required for 1.0 and not implemented. |
| `DEFERRED` | Explicitly out of 1.0 (usually 1.1 / 2.0). |
| `BLOCKED` | Waiting on a Cursor decision, API freeze, or prerequisite task. |

Never mark `VERIFIED` from a previous progress report.

---

## 3. Architectural invariants

1. Canonical state is `ModelDocument` plus `@modeling-kit/mesh` kernels. Render objects are derived.
2. Headless packages must not import DOM, `PointerEvent`, WebGL, canvas globals, or `three` in their main entry.
3. Three.js belongs in `@modeling-kit/three-adapter`. Host DOM binding belongs in `@modeling-kit/input/dom`.
4. Mutations go through validated operations and commands. Exact undo uses snapshots or patches, never approximate inverse math.
5. Topology operations return a complete `TopologyMapping` (vertices, edges, faces, corners).
6. Selection, UVs, seams, materials, and derived render data must follow mappings.
7. Long-lived services expose idempotent `dispose()`.
8. State machines are finite and explicit. Derived work is revisioned / dirty-flagged.
9. Public modeling APIs are renderer-neutral unless marked adapter APIs.
10. No Minecraft, Blockbench, OptiFine, GeckoLib, or other game formats.

---

## 4. Shared operator contract

Owner: `@modeling-kit/mesh` (`src/operations/contract.ts`).

Every topology-changing operator must accept `MeshOperationContext` and return `MeshOperationResult` (or a type that extends it).

Required result fields:

- `mesh` — mutated kernel (in-place, documented)
- `changes` — element count deltas
- `mapping` — `preserved`, `deleted`, `created`, `replacedBy`, `derivedFrom` per element kind
- `selection` — suggested post-op domain and IDs
- `warnings` — structured codes, never string-only failures for expected invalid input

Invalid input must not leave a half-mutated mesh. Prefer throw-before-mutate or transactional rebuild with rollback.

Deterministic ID rule for face splits (`cutFace`): preserve the original `FaceId` on the sub-polygon that contains the original lowest-ID corner.

---

## 5. Requirement catalog

Acceptance is measurable. Status lives in the evidence matrix, not here.

### 5.1 Architecture and core (`ARCH`, `CORE`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| ARCH-001 | Clean-room implementation; no GPL Blockbench code; no game formats | Provenance log current; repo search finds no `.bbmodel` / MoLang codecs |
| ARCH-002 | Headless core packages run in Node without `three` or DOM | Package graphs and entry imports contain neither; Vitest Node environment passes |
| ARCH-003 | Three.js isolated to `@modeling-kit/three-adapter` (and optional host) | `@modeling-kit/sdk` headless facade does not require `three` |
| ARCH-004 | Branded IDs; never persist render indices | Public types use `Brand<string, …>` |
| ARCH-005 | Approved dependencies only | New deps logged in provenance with 10-point review |
| ARCH-006 | No competing document/scene/selection systems | Single `ModelDocument` scene graph; tools do not own topology |
| CORE-001 | `Result`, structured errors, ID factories | Exported from `@modeling-kit/core` |
| CORE-002 | Geometry tolerances on `MeshOperationContext` | Shared epsilon / angleEpsilon |
| CORE-003 | Resource and operation lifecycle machines | Illegal transitions throw; disposal is terminal |
| CORE-004 | Document and mesh revision counters | Hover/selection do not bump topology revision |
| CORE-005 | Resource diagnostics counters | Subscriptions, GPU handles, jobs queryable |

### 5.2 Document and scene (`DOC`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| DOC-001 | Versioned `ModelDocument` with schema version and migrations | Load old fixtures; reject unsupported forward versions |
| DOC-002 | Stable scene-node IDs, root order, parent-child hierarchy | Cycle and duplicate-child rejection tests |
| DOC-003 | Node types: group, mesh/mesh_instance, primitive, locator, armature, camera, light | Types exist and serialize; unused types documented |
| DOC-004 | Local transforms; cached world transforms; preserve-world reparent | Only affected descendants invalidate; undo reparent |
| DOC-005 | Group / ungroup; linked mesh instances; independent duplication | Shared mesh survives deleting one instance |
| DOC-006 | Effective visibility and locking | Parent hide/lock affects descendants |
| DOC-007 | Resource usage indexes | Unused mesh/material/texture detection |
| DOC-008 | Scene validation and structured change sets | `document:changed.kind` distinguishes transform vs topology |
| DOC-009 | Transactions | Rollback leaves no history entry and restores document |
| DOC-010 | Deterministic native JSON serialization | Byte-stable or canonical-key stable round-trip fixtures |

### 5.3 Mesh kernel (`MESH`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| MESH-001 | Vertices, edges, faces, corners, half-edges with branded IDs | Queries: vertex edges/faces, face edges, adjacent faces, boundary, components |
| MESH-002 | Manifold, non-manifold, degenerate, winding validation | `validateMesh` reports codes |
| MESH-003 | Per-corner UVs/colors; per-edge seam/sharp/crease; per-face material slot | Survive serialize and operators that claim propagation |
| MESH-004 | Derived triangulation with source `FaceId` | Every triangle maps to a live face |
| MESH-005 | Public element operators (add/delete vertex, edge, face) return mappings | Not only `MeshBuilder` / internal `deleteFace` |

### 5.4 Topology operators (`MESH-OP`)

Unless deferred, each operator: valid topology after success; complete mapping; attribute policy honored; invalid input rejected without mutation; unit tests covering triangle, quad, n-gon or documented restriction; undo via command snapshot.

| ID | Operator | Notes |
| -- | -------- | ----- |
| MESH-OP-001 | `splitEdge` | t ∈ (0,1); per-face UV interpolation |
| MESH-OP-002 | `cutFace` | V-V, V-E, E-E; deterministic face ID rule |
| MESH-OP-003 | `connectVertices` | Via `cutFace` |
| MESH-OP-004 | `mergeVertices` | Target policies: center, active, first, last, custom |
| MESH-OP-005 | `mergeVerticesByDistance` | Cluster weld |
| MESH-OP-006 | `dissolveEdge` | Manifold shared edge; material compatibility |
| MESH-OP-007 | `triangulateFaces` | FaceId traceability |
| MESH-OP-008 | `extrudeFaces` | Individual normals |
| MESH-OP-009 | `extrudeRegion` | Boundary quads only |
| MESH-OP-010 | `insetFaces` individual | Even/relative offset; clamp; reject self-intersection or structured warning |
| MESH-OP-011 | `insetFaces` region | Island perimeter |
| MESH-OP-012 | `loopCut` | Quad loops; poles/triangles/n-gons terminate; documented |
| MESH-OP-013 | `bevelEdges` | Chains, valence, width clamp, segments; non-manifold reject |
| MESH-OP-014 | `subdivideFaces` linear | Mapping `replacedBy` |
| MESH-OP-015 | `catmullClarkSubdivide` | **1.0 included** if exported; crease/boundary rules tested or limitations listed |
| MESH-OP-016 | `bridgeLoops` | Boundary loop quads |
| MESH-OP-017 | `fillBoundary` | ngon / fan / triangulate |
| MESH-OP-018 | Knife planner + executor | Atomic; preview/commit parity |
| MESH-OP-019 | `deleteVertices` | Mapping; incident faces handled per documented policy |
| MESH-OP-020 | `deleteEdges` | |
| MESH-OP-021 | `deleteFaces` | Public contract, not internal-only |
| MESH-OP-022 | `addVertex` / `addEdge` / `addFace` | Validated construction with mapping |
| MESH-OP-023 | `dissolveVertex` / `dissolveFace` | |
| MESH-OP-024 | `collapseEdge` | |
| MESH-OP-025 | `duplicateSelection` / `separateFaces` / `joinMeshes` | |
| MESH-OP-026 | `trianglesToQuads` | |
| MESH-OP-027 | `reverseFaceWinding` | |
| MESH-OP-028 | Cleanup: loose, duplicates, degenerates, zero-length, components | May wrap `healMesh` if complete |

### 5.5 Commands and history (`CMD`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| CMD-001 | Command execute/undo/redo; merge; transactions | Fingerprint restore |
| CMD-002 | One history entry per completed gesture; cancel commits zero | |
| CMD-003 | Failed command does not mutate durable state | |
| CMD-004 | Selection restored on undo when the command changed selection | |
| CMD-005 | Commands consume `TopologyMapping` (remap + drop deleted IDs) | Not only `selection.replace` of suggestions |
| CMD-006 | Mesh commands wrap kernel ops; no duplicate algorithms | |

### 5.6 Selection, transform, snap, input (`SEL`, `XF`, `SNAP`, `INP`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| SEL-001 | Object/vertex/edge/face domains; active element; add/remove/toggle/clear | |
| SEL-002 | Invert, grow, shrink, select linked | Mesh-aware; tested |
| SEL-003 | Edge loop, edge ring, boundary, coplanar | Documented restrictions |
| SEL-004 | Box/lasso/x-ray/front-facing | May use adapter candidates; canonical IDs |
| SEL-005 | Multi-viewport shared selection; hover is viewport-local | |
| SEL-006 | Remap after topology ops | Integration tests: extrude selects caps; deleted IDs leave |
| XF-001 | Move/rotate/scale; object and component; spaces; pivots; constraints | |
| XF-002 | Transform state machine idle→beginning→transforming→committing→completed; cancel path | `OperationLifecycleMachine` or equivalent |
| XF-003 | Object move updates matrices only; vertex move updates affected buffers | Adapter dirty flags |
| SNAP-001 | Reusable snap service: grid, increment, angle, vertex, edge, midpoint, face | Tools call the service; knife does not reimplement |
| SNAP-002 | Priority, hysteresis, screen-space threshold, exclude selection | |
| INP-001 | Headless input packets/actions; DOM optional | |
| INP-002 | ToolManager + InteractionCoordinator; pointer claims; lost capture | |
| INP-003 | Knife, loop cut, extrude, bevel, merge tools with preview/commit/cancel | |

### 5.7 Primitives (`PRIM`)

Each generator: winding, outward normals, UVs, semantic groups where applicable, no degenerates, deterministic, validate parameters.

`PRIM-001` box, `PRIM-002` plane, `PRIM-003` grid, `PRIM-004` circle, `PRIM-005` disc, `PRIM-006` cylinder, `PRIM-007` cone, `PRIM-008` pyramid, `PRIM-009` uvSphere, `PRIM-010` icosphere, `PRIM-011` capsule, `PRIM-012` torus, `PRIM-013` ramp, `PRIM-014` stairs, `PRIM-015` arch, `PRIM-016` wall, `PRIM-017` column.

`PRIM-018` catalog + `CreatePrimitiveCommand` + undo/serialize.

Document `PrimitiveType` strings must match `@modeling-kit/primitives` (no parallel `uv-sphere` vs `uvSphere` without a documented alias map).

### 5.8 Viewport (`VP`)

| ID | Requirement | Acceptance |
| -- | ----------- | ---------- |
| VP-001 | Incremental sync from document events | Selection/hover does not rebuild topology buffers |
| VP-002 | Perspective and orthographic; multiple adapters per session | |
| VP-003 | Canonical picking via CPU `Raycaster` (not GPU ID buffer unless implemented) | Docs and APIs must not say “GPU raycast” unless an ID-buffer pass exists |
| VP-004 | Vertex/edge/face overlays; theme; dispose | |
| VP-005 | Spatial acceleration optional behind `SpatialQueryBackend` | No three-mesh-bvh in core |

### 5.9 Materials, textures, UV, images, paint (`MAT`, `TEX`, `UV`, `IMG`, `PAINT3D`)

Materials and textures are canonical on `ModelDocument`. GPU materials are adapter caches.

UV: per-corner storage, seams, islands, projections, packing, editor selection/transform session, analysis (overlap/flip). Seam-based LSCM / ABF unwrap may be `PARTIAL` if only heuristic “smart” projection exists — document the algorithm.

Images: tiled RGBA, layers, masks, blend modes, tile-patch undo.

Paint: 2D stroke machine; 3D maps host hits to UV/pixels without storing GPU objects.

### 5.10 Formats (`FMT`)

| ID | Requirement |
| -- | ----------- |
| FMT-001 | Native JSON schema, validation, migrations, unknown metadata preservation |
| FMT-002 | glTF/GLB import and export with conversion/data-loss reports |
| FMT-003 | OBJ import/export |
| FMT-004 | STL export; import if claimed |
| FMT-005 | Image import/export for paint documents |
| FMT-006 | Cancellation on large files |

### 5.11 Lifecycle, performance, extensions, AI, docs (`LIFE`, `PERF`, `EXT`, `AI`, `DX`)

| ID | Requirement |
| -- | ----------- |
| LIFE-001 | Adapter/document/tool dispose idempotent; remount resource baseline |
| LIFE-002 | Workers, object URLs, timers cancelled |
| PERF-001 | Benchmarks recorded for 10k/100k verts, 1k nodes, four viewports, pick latency |
| EXT-001 | Disposable registries for tools/commands/importers; no mutable unguarded globals |
| EXT-002 | `session.capabilities.canExecute(id)` with structured reason |
| AI-001 | `getEditorToolDefinitions` / `executeEditorTool` stable schemas |
| DX-001 | Architecture docs, getting started, compiling examples in CI |

### 5.12 Explicit deferrals (Release 1.1 / 2.0)

| ID | Item | Target |
| -- | ---- | ------ |
| RIG-001 | Production rigging: weight painting UI, limit/normalize tools, retarget | 1.1 |
| ANIM-001 | Full clip editor, NLA, animation events, glTF animation completeness | 1.1 |
| MESH-OP-CC-ADV | Crease-weight Catmull–Clark production feature set | 1.1 if 1.0 only ships basic levels |
| BOOL-001 | Boolean backend (Manifold adapter) | 1.1 |
| GPU-PICK-001 | GPU ID-buffer picking | Optional 1.1 |
| FMT-FBX | FBX | Never required for 1.0 |

Existing `@modeling-kit/rigging` and `@modeling-kit/animation` packages may remain as **preview** APIs. They are not Release 1.0 completion gates unless a requirement above is `VERIFIED`.

---

## 6. Foundational topology operations (behavior)

### 6.1 `splitEdge`

Inputs: `edgeId`, parametric `t ∈ (0, 1)`. Interpolate position, split twins, keep incident face IDs, interpolate per-corner UVs independently (seams), colors, normalized weights, preserve seam/sharp/crease.

### 6.2 `cutFace`

Endpoints: vertex↔vertex, vertex↔edge, edge↔edge. Edge endpoints split via `splitEdge`. Diagonal must lie in the face. Lowest-corner ID rule for preserved `FaceId`.

### 6.3 `connectVertices`

Two non-adjacent vertices of one face → `cutFace`.

### 6.4 `mergeVertices` / `mergeVerticesByDistance`

Collapse edges, purge faces with fewer than 3 corners, resolve duplicate edge pairs.

### 6.5 `dissolveEdge`

Fuse two compatible faces; result ≥ 3 unique vertices.

### 6.6 Extrude / inset / loop cut / knife / bevel

- **inset:** planar even-offset (edge parallel, miter intersections). Concave faces use the same offset; self-intersection or winding inversion throws in `strict` and does not mutate (transactional).
- **loopCut:** walks opposite edges of **quad** faces only. Triangle and n-gon faces terminate the walk. A loop of fewer than two edges is rejected. `previewLoopCut` never mutates; `loopCut` is transactional.
- **bevel:** interior manifold edges only; missing/boundary edges throw before mutate. Offset is clamped to `[0.05, 0.45]`.
- **knife:** `planKnifeStroke` / `executeKnifePlan` are the kernel. `KnifeTool` stores hits and overlay only; commit is `KnifeCutCommand` / `ExecuteKnifePlanCommand`.
- **extrude:** individual vs region in kernel; `ExtrudeTool` holds distance until a command runs.

Interactive tools use `ModalToolSession` (`OperationLifecycleMachine` with `recycle()`). They must not own topology.

---

## 7. Implementation phasing (dependency order)

1. Core contracts, IDs, math, tolerances, diagnostics, results  
2. Document, scene, resources, events, transactions, serialization  
3. Mesh topology, validation, attributes, operator kernel  
4. Commands, history, remapping, selection restoration  
5. Selection, transforms, snapping, input, tool machines  
6. Primitives and modifiers  
7. Viewport contracts and Three.js adapter  
8. Materials, textures, color  
9. UV  
10. Image layers and 2D paint  
11. 3D paint  
12. Import/export  
13. AI schemas, examples, docs  
14. Lifecycle, memory, performance, release verification  

Do not implement advanced UV/paint/boolean work while MESH-005, SEL-002, and CMD-004 remain unresolved.

---

## 8. Duplicate, conflicting, or misplaced systems (audit)

These must be resolved under Cursor ownership; Antigravity must not invent a third copy.

1. **Operator re-exports in `@modeling-kit/tools`** — wrappers/aliases of `@modeling-kit/mesh`. Tools own interaction only.
2. **`packages/mesh/src/extrude.ts`** — barrel over `operations/extrude-faces` plus internal `deleteFace` public export.
3. **Knife files** — `operations/knife-planner.ts` re-exports `operations/knife/*` (acceptable barrel; do not add a third planner).
4. **Scene `PrimitiveType` vs primitives catalog** — `uv-sphere` / `ico-sphere` / `cube` vs `uvSphere` / `icosphere` / `box`.
5. **`SceneNodeType` aliases** — `reference-image` and `reference_image`.
6. **`MaterialDefinition` = `MaterialData`** — convenience alias; do not add a third DTO.
7. **`extensionNodeRegistry` global `Map`** — replaced by per-document `SceneNodeExtensionRegistry` (`EXT-001` / R1-T008).
8. **`@modeling-kit/sdk` depends on `three-adapter`** — resolved: headless `@modeling-kit/sdk`; viewport via `@modeling-kit/three-adapter` or `@modeling-kit/sdk/three` (`ARCH-003` / R1-T007).
9. **Picking named “GPU”** in README/checklist — implementation is `THREE.Raycaster` (`VP-003`).
10. **Competing completion trackers** — `docs/release-1.0-checklist.md`, `docs/architecture/uv-image-paint-sdk-roadmap.md`, `docs/coordination/SDK-VERIFICATION.md`, `docs/roadmap.md` Phase 9 complete. Evidence file supersedes their status claims.
11. **`deleteFace` is internal kernel mutation** without public `MeshOperationResult` (`MESH-OP-021`).

---

## 9. External tools (evaluation only)

Candidates (Repomix, dependency-cruiser, Knip, ast-grep, fast-check, three-mesh-bvh, Earcut, Manifold) require Cursor approval and a provenance 10-point entry before install. Optional engines sit behind interfaces in `docs/architecture/dependency-policy.md`. Antigravity cannot add dependencies.

---

## 10. Verification gates

A requirement is not `VERIFIED` until applicable gates pass: strict typecheck, targeted tests, lint/format, package build, dependency boundaries, undo/remap, invalid-input, disposal, and documentation.

Operator tests must assert invariants (manifoldness, unique IDs, valid refs, deterministic mappings, attribute preservation), not only snapshots.
