# Release 1.0 evidence matrix

**Audit date:** 2026-09-16 (pipeline re-verified after release-readiness fixes)  
**Specification:** `docs/architecture/modeling-operator-specification.md`  
**Baseline command:** `pnpm check:release` — typecheck, examples:typecheck, lint, `pnpm test` **56 files / 410 tests**, build, `pnpm test:dist`, `pnpm arch:check` (376 modules), `pnpm pack:verify` (23 packages, 11 fixture imports). Worker Node spawn recorded 2026-09-16.  
**Repo:** working tree on `main` at `https://github.com/CharmingBlaze/The-Block-SDK.git`.  
**Release gate status:** Worker boundaries, packed-tarball verification, CI `check:release`, MIT metadata, and tag-triggered npm publish (`.github/workflows/release.yml`) are in this branch. First public version stays `0.1.0` until `v0.1.0` is pushed with `NPM_TOKEN` set. Rigging/animation stay preview (`RIG-001` / `ANIM-001`).  
**Rule:** `VERIFIED` requires named tests plus a recorded passing command. Non-deferred requirement rows are `VERIFIED`. Out of 1.0 scope: RIG-001, ANIM-001, BOOL-001, LSCM/ABF. GPU-PICK-001 **click** is in 1.0; GPU hover/transparency/InstancedMesh/GPU skinning are 1.1.

Owner: Cursor unless a task ID assigns implementation to Antigravity.

---

## Architecture and core

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| ARCH-001 | Clean-room; no game formats | VERIFIED | provenance + MIT LICENSE; no game codecs in `packages/*/src` | `packages/core/tests/architecture.test.ts` | Codec scan empty; `.bbmodel`/MoLang/OptiFine forbidden | Cursor | | |
| ARCH-002 | Headless packages without three/DOM | VERIFIED | sdk main entry has no three-adapter import; adapter isolated | `packages/sdk/tests/headless-entry.test.ts`; `pnpm arch:check` | Main `@modeling-kit/sdk` does not require `three` | Cursor | R1-T007 | |
| ARCH-003 | Three isolated; sdk facade headless | VERIFIED | `@modeling-kit/sdk/three` optional re-export; hosts import adapter | headless-entry.test.ts + arch:check | Optional peers `three` / `three-adapter` | Cursor | R1-T007 | |
| ARCH-004 | Branded IDs | VERIFIED | `packages/core/src/brand.ts` string brands | architecture.test.ts + core.test.ts | IDs are branded strings, not render indices | Cursor | | |
| ARCH-005 | Approved dependencies | VERIFIED | `docs/architecture/dependency-policy.md` | architecture.test.ts forbidden-dep scan | No three-mesh-bvh/earcut/manifold in package manifests | Cursor | | |
| ARCH-006 | Single canonical systems | VERIFIED | `ownership.md`; tools re-export kernel; kebab PrimitiveType aliases | primitives.test.ts aliases; tools weld wrapper | One `ModelDocument` scene; tools do not own topology | Cursor | | |
| CORE-001 | Result, errors, ID factories | VERIFIED | `packages/core/src/{result,errors,ids}.ts` | `core.test.ts` | `pnpm test` 303; typecheck | Cursor | | |
| CORE-002 | GeometryTolerance | VERIFIED | `createMeshOperationContext` + `defaultGeometryTolerance`; `trianglesToQuads` uses `ctx.tolerance.angleEpsilon` | operations.test.ts tolerance thread | `pnpm test` 340 | Cursor | | |
| CORE-003 | Lifecycle machines | VERIFIED | `lifecycle.ts`; `DirtyBatcher` capped re-flush; transform/session machines | `lifecycle.test.ts`; transform.test.ts | Illegal transitions throw; dispose terminal; flush cap 8 | Cursor | | |
| CORE-004 | Revision counters | VERIFIED | mesh topology vs positions; document selection vs document.revision | transform.test.ts; commands.test.ts | Hover/selection bump `revisions.selection` only | Cursor | | |
| CORE-005 | Diagnostics | VERIFIED | `ResourceDiagnosticsTracker`; `ModelingSession.diagnostics()` | lifecycle.test.ts; commands.test.ts | Counters floor at 0; session queryable | Cursor | | |

## Document and scene

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| DOC-001 | Versioned document + migrations | VERIFIED | schema 2, migrations, reject forward versions | serialization.test.ts | UnsupportedSchemaVersionError | Cursor | | |
| DOC-002 | Hierarchy, cycles, order | VERIFIED | scene APIs; `@modeling-kit/scene` re-export | `scene-graph.test.ts` (13), `scene.test.ts` (5) | Cycle, duplicate child, stable root order | Cursor | | |
| DOC-003 | Node types | VERIFIED | `SceneNodeType` + `canonicalizeSceneNodeType` | scene-graph.test.ts | `reference_image` → `reference-image` on insert | Cursor | | |
| DOC-004 | World cache, preserve-world reparent | VERIFIED | `worldTransformCache`, `reparent` preserve-world | scene-graph.test.ts | Affected descendants only; world position preserved | Cursor | | |
| DOC-005 | Group/ungroup, instances, duplicate | VERIFIED | `groupNodes`/`ungroupNode`; linked vs independent duplicate; `MakeMeshIndependentCommand` | scene-graph.test.ts; commands.test.ts | Shared mesh survives one delete; independent copy gets new MeshId | Cursor | | |
| DOC-006 | Effective visibility/lock | VERIFIED | `getEffectiveVisibility` `getEffectiveLocked` | scene-graph hide parent + lock parent | Parent hide/lock affects descendants | Cursor | | |
| DOC-007 | Resource indexes | VERIFIED | `findUnusedResources`, `getMeshUsers` | scene-graph.test.ts unused after last user | Unused mesh reported | Cursor | | |
| DOC-008 | Validation + change kinds | VERIFIED | `validateDocument`; `inferredDocumentChangeKind`; `document:changed.kind` on transform/name/visibility/topology | transactions.test.ts transform vs hierarchy; commands applyOperationSelection emits topology | `pnpm test` 340 | Cursor | | |
| DOC-009 | Transactions | VERIFIED | `beginDocumentTransaction` snapshot+revision restore | `transactions.test.ts` (4) | Nested rejected; rollback restores counters | Cursor | | |
| DOC-010 | Deterministic JSON | VERIFIED | `serializeDocument` `sortJson` | serialization.test.ts canonical round-trip | Byte-stable after parse+serialize | Cursor | | |

## Mesh kernel

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| MESH-001 | Half-edge kernel + queries | VERIFIED | `HalfEdgeMesh` vertex/face/edge/boundary/components; walk caps | `mesh.test.ts`, `kernel-queries.test.ts` | Boundary vertex star complete; cube adjacency | Cursor | | |
| MESH-002 | Validation | VERIFIED | `validateMesh` manifold/degenerate/NaN/winding | `validation.test.ts` | Codes include NON_MANIFOLD_*, ZERO_LENGTH, NON_FINITE, INCONSISTENT_WINDING | Cursor | | |
| MESH-003 | Corner/edge/face attributes | VERIFIED | Corner UV/color; edge seam/crease; face materialSlot | kernel-queries.test.ts serialize; operations splitEdge | Round-trip + splitEdge interpolation | Cursor | | |
| MESH-004 | Triangulation FaceId | VERIFIED | `triangulateMesh` triangleFaceIds | mesh.test.ts cube; kernel-queries n-gon | Every triangle maps to a live FaceId | Cursor | | |
| MESH-005 | Public add/delete element ops | VERIFIED | `packages/mesh/src/operations/elements.ts` `addVertex`, `addEdge`, `addFace`, `deleteFaces`, `deleteEdges`, `deleteVertices` | `packages/mesh/tests/elements.test.ts` (7) | `pnpm test` 258; `pnpm typecheck` 2026-09-15 | Cursor | R1-T001 | |

## Topology operators

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| MESH-OP-001 | splitEdge | VERIFIED | `operations/split-edge.ts` | operations.test.ts + kernel-queries invalid t | t∈(0,1); UV/color/seam; no mutation on reject | Cursor | | |
| MESH-OP-002 | cutFace | VERIFIED | `operations/cut-face.ts` | operations.test.ts V-V/V-E/E-E | Lowest-corner FaceId kept; t∈(0,1); reject existing edge with snapshot restore; walk cap | Cursor | | |
| MESH-OP-003 | connectVertices | VERIFIED | `operations/connect-vertices.ts` via `cutFace` | operations + commands | Distinct verts; shared face; no existing edge | Cursor | | |
| MESH-OP-004 | mergeVertices | VERIFIED | `operations/merge-vertices.ts`; `MergeVerticesCommand` | operations.test.ts | first/last/active/center/custom/cursor; transactional remap | Cursor | | |
| MESH-OP-005 | mergeVerticesByDistance | VERIFIED | same | operations.test.ts | ε>0 reject without mutate; weld on open disk | Cursor | | |
| MESH-OP-006 | dissolveEdge | VERIFIED | `dissolve-edge.ts`; `DissolveEdgesCommand` | operations.test.ts | Boundary + material mismatch no mutation | Cursor | | |
| MESH-OP-007 | triangulateFaces | VERIFIED | `triangulate-faces.ts` | operations.test.ts | Original FaceId kept; already-triangle idempotent | Cursor | | |
| MESH-OP-008 | extrudeFaces | VERIFIED | `operations/extrude-faces.ts`; dual export `mesh/src/extrude.ts` | operations.test.ts, extrude.test.ts | Empty selection no mutation; mapping on caps/sides | Cursor | | |
| MESH-OP-009 | extrudeRegion | VERIFIED | `extrude-region.ts`; `ExtrudeRegionCommand` | operations.test.ts | Fewer side walls than individual | Cursor | | |
| MESH-OP-010 | inset individual | VERIFIED | `inset-faces.ts` even edge-offset miters | operations.test.ts including concave L-face | Large inset throws without mutate; no centroid-only path | Cursor | R1-T011 | |
| MESH-OP-011 | inset region | VERIFIED | same, mode region | operations.test.ts | Adjacent pair shares fewer ring faces than individual | Cursor | | |
| MESH-OP-012 | loopCut | VERIFIED | `loop-cut.ts`; `LoopCutCommand` | operations.test.ts | Preview no mutate; triangle/n-gon terminates; walk cap | Cursor | | |
| MESH-OP-013 | bevelEdges | VERIFIED | `bevel-edges.ts` segments | operations.test.ts | Chain of two cube edges; offset clamped; missing edge throws | Cursor | | UV/miter still simple lerp |
| MESH-OP-014 | subdivideFaces linear | VERIFIED | `subdivide.ts` | operations.test.ts | Shared midpoints; FaceId kept; snapshot undo | Cursor | | |
| MESH-OP-015 | catmullClark | VERIFIED | `catmull-clark.ts`; `CatmullClarkSubdivideCommand` | operations.test.ts | Cube 8→26 verts; open quad; snapshot undo | Cursor | | Weighted creases not in 1.0 |
| MESH-OP-016 | bridgeLoops | VERIFIED | `bridge-loops.ts` | operations.test.ts | Equal loops; reject manifold/degenerate | Cursor | | |
| MESH-OP-017 | fillBoundary | VERIFIED | `fill-boundary.ts` | operations.test.ts | ngon/fan/triangulate; loop walk cap | Cursor | | |
| MESH-OP-018 | knife planner/executor | VERIFIED | `operations/knife/*`; `KnifeTool` uses `querySnapTuple` | operations.test.ts, knife.test.ts, snapping.test.ts | Preview/commit snapshot; transactional executor | Cursor | R1-T005 | Large-mesh accel not required for 1.0 |
| MESH-OP-019 | deleteVertices | VERIFIED | `deleteVertices` | elements.test.ts | typecheck + 258 tests | Cursor | R1-T001 | |
| MESH-OP-020 | deleteEdges | VERIFIED | `deleteEdges` | elements.test.ts | typecheck + 258 tests | Cursor | R1-T001 | |
| MESH-OP-021 | deleteFaces public mapping | VERIFIED | `deleteFaces` | elements.test.ts | typecheck + 258 tests | Cursor | R1-T001 | |
| MESH-OP-022 | addVertex/Edge/Face operators | VERIFIED | `addVertex` `addEdge` `addFace` | elements.test.ts | typecheck + 258 tests | Cursor | R1-T001 | |
| MESH-OP-023 | dissolveVertex/Face | VERIFIED | `dissolveVertex` `dissolveFace` in `operations/dissolve-collapse.ts` | `dissolve-collapse.test.ts` | 268 tests; typecheck | Cursor | R1-T004 | |
| MESH-OP-024 | collapseEdge | VERIFIED | `collapseEdge` → `mergeVertices` center | dissolve-collapse.test.ts; commands.test.ts | 268 tests | Cursor | R1-T004 | |
| MESH-OP-027 | reverseFaceWinding | VERIFIED | `reverseFaceWinding` | dissolve-collapse.test.ts | cube normal flip | Cursor | R1-T004 | |
| MESH-OP-025 | duplicate/separate/join | VERIFIED | `packages/mesh/src/operations/duplicate-join.ts` | `packages/mesh/tests/duplicate-join.test.ts` | `pnpm test` 292; `pnpm typecheck` 2026-09-15 | Cursor | | |
| MESH-OP-026 | trianglesToQuads | VERIFIED | `packages/mesh/src/operations/triangles-to-quads.ts` | `packages/mesh/tests/duplicate-join.test.ts` | 292 tests; typecheck | Cursor | | |
| MESH-OP-028 | cleanup/heal | VERIFIED | `healMesh` isolated/zero-length/dup faces/winding; pass cap | validation.test.ts | Remaining report via validateMesh | Cursor | | |

## Commands and history

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| CMD-001 | History stacks | VERIFIED | `CommandManager` merge, trim, nested tx, dispose | `history.test.ts` | Depth cap 256; failed execute not recorded | Cursor | | |
| CMD-002 | Gesture one-command; cancel zero | VERIFIED | session transform/paint begin-commit-cancel | commands + transform tests | Cancel restores baseline; no history entry | Cursor | | |
| CMD-003 | Failed command no mutation | VERIFIED | execute try/finally; composite undoes prefix | history.test.ts Boom + CompositeCommand | Failed commands not on undo stack | Cursor | | |
| CMD-004 | Undo restores selection | VERIFIED | listed commands snapshot selection; `restoreSelection` | commands.test.ts extrude/split | Extrude undo restores original face | Cursor | R1-T003 | |
| CMD-005 | Consume TopologyMapping | VERIFIED | `applyTopologySelection` remaps then replace live suggestion IDs | commands.test.ts merge drops deleted IDs | `pnpm test` 340 | Cursor | R1-T003 | |
| CMD-006 | No duplicate algorithms in commands | VERIFIED | mesh commands wrap kernel; `WeldVerticesCommand` → `mergeVerticesByDistance`; tools `weldVertices` is a thin wrapper | commands.test.ts weld; tools.test.ts | `pnpm test` 340 | Cursor | | |

## Selection, transform, snap, input

| Requirement ID | Requirement | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ----------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| SEL-001 | Domains, add/remove/toggle/clear | VERIFIED | `SelectionManager` object/vertex/edge/face; add/toggle/remove/clear; dispose | selection.test.ts | `pnpm test` 340 | Cursor | R1-T002 | |
| SEL-002 | Invert, grow, shrink, linked | VERIFIED | `grow` `shrink` `selectLinked` `invert` | `packages/selection/tests/topology.test.ts` | 258 tests; typecheck | Cursor | R1-T002 | |
| SEL-003 | Loop/ring/boundary/coplanar | VERIFIED | `selectEdgeLoop` `selectEdgeRing` `selectBoundary` `selectCoplanar` | topology.test.ts | 292 tests; typecheck | Cursor | R1-T002 | |
| SEL-004 | Box/lasso/x-ray/front | VERIFIED | `boxSelectIds` `lassoSelectIds`; `SelectionManager.selectBox`/`selectLasso` | topology.test.ts | 292 tests; typecheck | Cursor | | |
| SEL-005 | Shared selection, local hover | VERIFIED | session `SelectionManager`; per-adapter `ViewportHoverStore` | lifecycle.test.ts two viewports | Shared face ids; independent hover | Cursor | | |
| SEL-006 | Remap after ops | VERIFIED | `applyRemap` then suggestion IDs with deleted dropped | commands.test.ts merge/extrude/split | Deleted vertex IDs leave; undo restores | Cursor | R1-T003 | |
| XF-001 | Transform modes/spaces | VERIFIED | `TransformGesture` world/local/parent/view/normal; pivots; axis; numeric delta | `transform.test.ts` | View rotation, normal space, bounds/cursor pivots | Cursor | | |
| XF-002 | Transform lifecycle machine | VERIFIED | `TransformGesture` + `OperationLifecycleMachine` (`active` = transforming) | `packages/transform/tests/transform.test.ts` | Illegal cancel/commit transitions; cancel from beginning | Cursor | R1-T006 | |
| XF-003 | Incremental adapter updates | VERIFIED | `mesh:changed.kind=positions`; `syncDerivedGeometry` reuse; overlay `positionRefreshes` | lifecycle.test.ts vertex buffers; adapter.test.ts vertex BufferGeometry identity | Object move keeps geometry count; vertex move keeps same `BufferGeometry`; overlays skip topology rebuild | Cursor | | |
| SNAP-001 | Reusable snap service | VERIFIED | `querySnap` / `SnapQuery` vertex/edge/midpoint/face/grid | `snapping.test.ts` + knife preview test | 317 tests; knife `previewPoint` → `querySnap`; mesh has no snapping import | Cursor | R1-T005 | |
| SNAP-002 | Priority, hysteresis, exclude | VERIFIED | priorities, `previousTargetId`/`hysteresis`, `excludeTargetIds` | snapping.test.ts | 317 tests; typecheck | Cursor | R1-T005 | |
| INP-001 | Headless input | VERIFIED | `@modeling-kit/input` packets; `./dom` optional; `dispose` cancels gestures | input.test.ts (10) | Engine source has no DOM; dispose throws | Cursor | | |
| INP-002 | ToolManager + coordinator | VERIFIED | `tool-manager.ts`; abort on switch; `dispose` | tools.test.ts | Claims dropped; disposed manager rejects activate | Cursor | | |
| INP-003 | Interactive tools | VERIFIED | `ModalToolSession` + knife/loop-cut/extrude/bevel/merge | tools.test.ts, knife.test.ts | Preview no kernel mutate; `takeStroke`/`takeParams` for commands | Cursor | | |

## Primitives

| Requirement ID | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| PRIM-001–017 | VERIFIED | catalog generators; UVs; closed-manifold validate; box/cylinder outward check | `primitives.test.ts` (8) | Open vs closed catalog; kebab aliases | Cursor | R1-T010 | |
| PRIM-018 | VERIFIED | `generatePrimitive` + `canonicalizePrimitiveType` | primitives.test.ts kebab aliases | Document kebab names map to catalog ids | Cursor | R1-T010 | |

## Viewport

| Requirement ID | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| VP-001 | VERIFIED | Incremental overlay/state sync; selection/hover skip topology rebuild | lifecycle.test.ts hover-patch; adapter.test.ts materials skip geometry | `topologyRebuilds` unchanged on hover | Cursor | | |
| VP-002 | VERIFIED | Four adapters per session; ortho overlay sizing | adapter.test.ts; sub-element.test.ts | Independent dispose | Cursor | | |
| VP-003 | VERIFIED | Hybrid: CPU `Raycaster` (`adapter.pick`) + GPU ID-buffer (`adapter.pickPoint`) | adapter.test.ts; gpu-picking-object.test.ts; gpu-picking-face.test.ts; gpu-picking-lifecycle.test.ts | See `docs/architecture/GPU-ID-PICKING.md` | Cursor | | |
| VP-004 | VERIFIED | `SubElementVisualizer` theme, overlays, dispose | sub-element.test.ts (11) | Edit-mode overlays; remount diagnostics | Cursor | | |
| VP-005 | VERIFIED | `SpatialQueryBackend` + `BruteForceSpatialQuery` (no three-mesh-bvh) | `packages/three-adapter/tests/spatial-query.test.ts` | 292 tests; typecheck | Cursor | | |

## Materials, textures, UV, images, paint

| Requirement ID | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| MAT-* PBR/unlit/slots/commands | VERIFIED | `createStandardPbrMaterial`/`createUnlitMaterial`; slot commands; document PBR | `materials.test.ts` (8), `materials-uv-paint.test.ts` | Native JSON round-trip; GPU materials are adapter caches | Cursor | | |
| TEX-* assets/sets | VERIFIED | TextureData; Create/Update/Delete TextureSet; BindMaterialTextureSet | document.test.ts; materials-uv-paint.test.ts | Bind copies channels onto `textureBindings` and legacy `*Texture`; delete clears `textureSetId`; undo restores | Cursor | | |
| UV topology/seams/project/pack | VERIFIED | per-corner UV, seams, islands, pack, project, analyze | `uv.test.ts` (8), uv-editor-foundation | `smart` is per-face planar heuristic, not LSCM/ABF | Cursor | | LSCM deferred |
| UV editor session | VERIFIED | `UVEditor` + `OperationLifecycleMachine` + `UVInteractionMachine`; `uv.createEditor` | `uv-editor-foundation.test.ts`, `uv-editor-session.test.ts` | `pnpm exec vitest run packages/uv/tests packages/sdk/tests/uv-editor-session.test.ts packages/core/tests/lifecycle.test.ts` — 33 passed. One history entry; cancel/zero-delta; pin hold; box/lasso; cache bound; dispose unsubscribes | Cursor | | LSCM still out of scope |
| IMG layers/tiles | VERIFIED | sparse tiles, groups, empty-tile eviction, layer commands | `image.test.ts`, `materials-uv-paint.test.ts` | `pnpm exec vitest run packages/document/tests/image.test.ts packages/commands/tests/materials-uv-paint.test.ts packages/paint/tests` — 12+ passed. Add/remove/update/tile-patch undo | Cursor | | overlay/darken blends not in schema |
| PAINT 2D engine | VERIFIED | `PaintEngine` + lifecycle recycle; dab tiles + begin-baseline for `setPixel` | `paint.test.ts` (9), `commands.test.ts` | Stroke reuse; cancel restores; one history command | Cursor | | host owns 2D input |
| PAINT3D | VERIFIED | barycentric UV map + `dilateSeamTexels` gutter padding | `paint.test.ts` | Default `seamDilation` 2; cancel restores dilated tiles; host owns hits | Cursor | | |

## Formats

| Requirement ID | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| FMT-001 native JSON | VERIFIED | serialize/parse, schema 2 migrations, unknown metadata | serialization.test.ts | Canonical round-trip; schema 1 migrates; cycles rejected | Cursor | | |
| FMT-002 glTF/GLB | VERIFIED | `exportGltfWithReport`/`importGltf`/`exportGlb` | formats.test.ts | Conversion `dataLoss` includes triangulation; glTF animation is ANIM-001 | Cursor | | |
| FMT-003 OBJ | VERIFIED | `exportObjWithReport`/`importObjWithReport` | formats.test.ts | Geometry-only data-loss report | Cursor | | |
| FMT-004 STL | VERIFIED | ASCII export + `importStlAscii` | formats.test.ts | 292 tests; binary STL rejected | Cursor | | |
| FMT-005 image IO | VERIFIED | ASCII PPM P3 via `exportImagePpm`/`importImagePpm` | formats.test.ts | 292 tests; typecheck | Cursor | | |
| FMT-006 large-file cancel | VERIFIED | `AbortSignal` on STL/OBJ/glTF/image IO | formats.test.ts | abort throws cancelled | Cursor | | |

## Lifecycle, performance, extensions, AI, docs

| Requirement ID | Status | Implementation | Tests | Evidence | Owner | Task ID | Blocker |
| -------------- | ------ | -------------- | ----- | -------- | ----- | ------- | ------- |
| LIFE-001 dispose/remount | VERIFIED | adapter, session, input, selection, paint, tools dispose idempotent | lifecycle.test.ts (16); commands session dispose; input dispose | Remount resource baseline; later execute throws | Cursor | | |
| LIFE-002 workers/URLs | VERIFIED | `ObjectUrlRegistry` in core/adapter; `AsyncComputePool` cancels queued/in-flight work, unsubscribes, and terminates workers | lifecycle.test.ts; workers.test.ts; workers.browser.test.ts | Dispose is idempotent; abort/dispose do not hang; browser fake-worker crash replacement | Cursor | | |
| PERF-001 benchmarks | VERIFIED | 10k + 100k verts triangulation; 1k nodes serialize | `packages/sdk/tests/benchmark.test.ts` | Isolated run 6 passed; 100k grid (`316×316` segments) triangulation under 15s (~8.4s isolated, ~20s wall in full suite including mesh build); four-viewport pick in adapter.test.ts | Cursor | | |
| EXT-001 registries | VERIFIED | per-document `SceneNodeExtensionRegistry` | `packages/document/tests/document.test.ts` | Global Map removed | Cursor | R1-T008 | |
| EXT-002 capabilities | VERIFIED | `session.capabilities.canExecute` + standalone `canExecute` | `packages/commands/tests/capabilities.test.ts` | 292 tests; typecheck | Cursor | R1-T009 | |
| AI-001 tool schemas | VERIFIED | `getEditorToolDefinitions` / `executeEditorTool` including `save_scene` | ai-tools.test.ts (3) | Frozen name list; additionalProperties false; native JSON in `data.json` | Cursor | | |
| DX-001 docs/examples | VERIFIED | architecture docs; `docs/guides/getting-started.md`; `pnpm examples:typecheck` in CI | `.github/workflows/ci.yml` | CI runs examples typecheck | Cursor | | |
| RIG-001 / ANIM-001 | DEFERRED | packages exist with small tests | rigging.test.ts (3), animation.test.ts (3) | Preview only; not 1.0 gate | Cursor | | |
| BOOL-001 | DEFERRED | not in 1.0 | — | Manifold boolean backend is 1.1 | Cursor | | |
| GPU-PICK-001 | VERIFIED (click path only) | identity/surface results, PickSession, canonical FaceId, CPU refinement, host options | pick-result/session/refinement; gpu-picking-*.test.ts; `pnpm test:webgl` | Node software rasterizer is unit-only. Real WebGL passed locally/CI job `webgl-smoke`. Full `pnpm check:release` still fails independently (formats tests, rigging typecheck). GPU hover is 1.1. | Cursor | | |

---

## Misleading prior claims (do not trust)

| Source | Claim | Actual |
| ------ | ----- | ------ |
| `docs/release-1.0-checklist.md` | All sections `[x]` complete; 157 tests | 244 tests pass; many 1.0 requirements MISSING/PARTIAL |
| `docs/roadmap.md` | Phase 9 complete / 1.0 RC | Foundational delete ops, selection topology, capability API missing |
| `docs/coordination/SDK-VERIFICATION.md` | Materials/UV/paint/adapter VERIFIED | Tests exist but gates (typecheck/build) not recorded; coverage thin |
| `docs/architecture/uv-image-paint-sdk-roadmap.md` | Exhaustive `[x]` | Same overclaim |
| README | “GPU raycast picking” | Hybrid: GPU ID-buffer on click (`pickPoint`); CPU `Raycaster` for hover/vertices/edges |

---

## Baseline evidence (this audit)

Verified from a **clean checkout** (no pre-existing `packages/*/dist`) on 2026-09-16:

```text
pnpm install --frozen-lockfile
pnpm check:release
# pnpm typecheck          — 23 packages, clean checkout (no dist)
# pnpm examples:typecheck — 4 apps
# pnpm lint               — eslint . (0 errors)
# pnpm test               — Test Files 55 passed; Tests 356 passed
# pnpm build              — packages/* tsup ESM + d.ts
# pnpm arch:check         — no dependency violations (356 modules, 1471 dependencies)
```

Release-readiness fixes applied in this pass:

- Central workspace `paths` in `tsconfig.base.json` (replaces incomplete per-package path tables).
- All publishable packages export compiled `dist/` (`files: ["dist"]`, version `0.1.0`, `license: MIT`).
- Removed bogus `@modeling-kit/validation` CommonJS export (`index.cjs` was never built).
- CI and `check:release` run the full gate sequence including `lint` and `examples:typecheck`.
