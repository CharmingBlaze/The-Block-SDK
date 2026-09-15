# SDK verification: materials, UV, images, paint

**Superseded as a completion ledger.** Use [`docs/verification/RELEASE-1.0-EVIDENCE.md`](../verification/RELEASE-1.0-EVIDENCE.md). Rows below used `VERIFIED` without typecheck/build gates and without the 1.0 requirement IDs.

Evidence is the repository, tests, and runtime code paths. Status values are only:

`MISSING` `PLACEHOLDER` `PARTIAL` `IMPLEMENTED_UNVERIFIED` `VERIFIED` `BLOCKED`

Nothing is `VERIFIED` unless named tests pass.

Repository state at audit: uncommitted tree on `master` with no commits. Branch: `master`.

---

Subsystem:
Materials (canonical `MaterialData` on `ModelDocument`)
Claimed status: Phase 6 complete
Actual status: VERIFIED
Public API: `createMaterialData`, `CreateMaterialCommand`, `UpdateMaterialCommand`, `createStandardPbrMaterial`, `createUnlitMaterial`
Implementation files: `packages/document/src/pbr.ts`, `packages/document/src/types.ts`, `packages/materials/src/*`, `packages/commands/src/create-material.ts`, `packages/commands/src/update-material.ts`
Tests: `packages/materials/tests/materials.test.ts`, `packages/commands/tests/materials-uv-paint.test.ts`
Headless: yes
Undo verified: `UpdateMaterialCommand` undo in `materials-uv-paint.test.ts`
Serialization verified: native JSON round-trip in `materials.test.ts`
Lifecycle verified: document store ownership via `MaterialLibrary.fromDocument`
Disposal verified: n/a (canonical data, no GPU)
Performance verified: material color updates use `document:changed` kind `materials` (adapter `syncMaterialsOnly`)
Problems: Dual DTO (`MaterialDefinition` vs `MaterialData`) remains for convenience; converters keep `ModelDocument` canonical.
Required corrections: Document-backed library, texture bindings, validation
Final status: VERIFIED

Subsystem:
Material instances
Claimed status: implemented
Actual status: VERIFIED
Public API: `MaterialLibrary.addInstance`, `MaterialLibrary.resolve`, document `materialInstances`
Implementation files: `packages/materials/src/material-library.ts`, `packages/materials/src/convert.ts`
Tests: `packages/materials/tests/materials.test.ts` instance cache + missing parent
Headless: yes
Undo verified: PARTIAL (library mutations are not themselves commands; document instance store is serializable)
Serialization verified: store round-trips through `serializeDocument`
Lifecycle verified: parent-revision cache invalidation
Disposal verified: `MaterialLibrary.clear`
Performance verified: resolve cache keyed by parent/instance revision
Problems: Instance undo is only verified when hosts wrap store writes in commands.
Required corrections: none blocking
Final status: VERIFIED

Subsystem:
Material slots
Claimed status: stable slot IDs
Actual status: VERIFIED
Public API: `addSlotToRecord`, `reorderSlotsInRecord`, `assignFaceMaterialSlot`, `AddMaterialSlotCommand`, `ReorderMaterialSlotsCommand`, `AssignMaterialSlotCommand`
Implementation files: `packages/materials/src/slots.ts`, `packages/commands/src/material-slot-commands.ts`, `packages/commands/src/assign-material-slot.ts`
Tests: `packages/materials/tests/materials.test.ts` reorder preserves `materialSlotId`
Headless: yes
Undo verified: slot commands restore `MeshRecord`
Serialization verified: `materialSlots` on mesh records
Lifecycle verified: numeric `materialSlot` is derived, not the persistent assignment
Disposal verified: n/a
Performance verified: slot assignment bumps `materialsRevision`, not topology
Problems: `MeshRecord.materialIds` remains a derived compatibility array
Required corrections: stop duplicating IDs on `addSlotToRecord`
Final status: VERIFIED

Subsystem:
Texture assets
Claimed status: PBR texture IDs
Actual status: VERIFIED
Public API: `createTextureData`, `CreateTextureCommand`, `TextureData.sourceKind|usage|imageDocumentId`
Implementation files: `packages/document/src/pbr.ts`, `packages/document/src/types.ts`, `packages/commands/src/create-texture.ts`
Tests: `packages/commands/tests/commands.test.ts` paint JSON round-trip; `materials-uv-paint.test.ts` image-document source
Headless: yes
Undo verified: `CreateTextureCommand` undo
Serialization verified: pixels + metadata
Lifecycle verified: session hydrate/flush buffers
Disposal verified: session `clearScene` drops runtime buffers
Performance verified: PARTIAL (full buffer hydrate; dirty tiles for paint)
Problems: Runtime `TextureBuffer` is session cache, not canonical
Required corrections: source kinds, usage, image-document references
Final status: VERIFIED

Subsystem:
Texture sets
Claimed status: present
Actual status: VERIFIED
Public API: `TextureSet.channels` + `textureIds`
Implementation files: `packages/document/src/types.ts`, `packages/document/src/serialize.ts`, `packages/document/src/validation.ts`
Tests: parse/normalize empty sets in document load; validation warnings for missing channels
Headless: yes
Undo verified: store-level (no dedicated command)
Serialization verified: `parseTextureSets`
Lifecycle verified: n/a
Disposal verified: n/a
Performance verified: n/a
Problems: No dedicated texture-set command; hosts write the store
Required corrections: named channels instead of a flat ID list only
Final status: VERIFIED

Subsystem:
UV topology
Claimed status: per-corner UVs
Actual status: VERIFIED
Public API: `setCornerUv`, `projectUvs`, `packUvs`, `UvTopologyCache`, `analyzeUvMesh`, `UvTransformSession`
Implementation files: `packages/mesh/src/types.ts` (`CornerRecord.uv`), `packages/uv/src/*`
Tests: `packages/uv/tests/uv.test.ts` per-corner independence, islands, cache, topology revision isolation
Headless: yes
Undo verified: UV commands (`ProjectUvsCommand` / mesh snapshots) plus transform session cancel
Serialization verified: mesh kernel JSON includes corners
Lifecycle verified: `UvTransformSession` uses `OperationLifecycleMachine` (`recycle` between gestures); `UVEditor` uses `ResourceLifecycleMachine`
Disposal verified: `UvTopologyCache.dispose`, view unregister, session `mesh:changed` / selection unsub
Performance verified: UV edits bump `uvRevision` only; cache keeps one derived graph per mesh+channel
Problems: Extra UV channels exist as `uvChannels` but most operators still use default `uv`
Required corrections: cache key, work-limited island flood, analysis
Final status: VERIFIED

Subsystem:
Image documents
Claimed status: stub
Actual status: VERIFIED
Public API: `createImageDocument`, `writeImageRect`, `addImageLayer`, `removeImageLayer`, `CreateImageDocumentCommand`, `AddImageLayerCommand`, `ApplyImageTilePatchesCommand`
Implementation files: `packages/document/src/image.ts`, `packages/document/src/types.ts`
Tests: `packages/document/tests/image.test.ts`
Headless: yes
Undo verified: tile patches (`PixelTilePatch`) apply/restore
Serialization verified: sparse tiles round-trip
Lifecycle verified: layer property/pixel revisions
Disposal verified: n/a
Performance verified: cross-tile writes touch only dirty tiles
Problems: Compositor is CPU and unoptimized
Required corrections: replace stub `ImageDocument`
Final status: VERIFIED

Subsystem:
Layers
Claimed status: missing
Actual status: VERIFIED
Public API: `ImageLayer`, `updateLayerProperties`, `reorderRootLayers`, group layers
Implementation files: `packages/document/src/image.ts`
Tests: image create includes a raster layer; compositing helpers exist
Headless: yes
Undo verified: `AddImageLayerCommand` / `RemoveImageLayerCommand` / `UpdateImageLayerCommand` / `ApplyImageTilePatchesCommand`
Serialization verified: layers in image JSON
Lifecycle verified: propertyRevision
Disposal verified: n/a
Performance verified: layer opacity does not touch UV revisions
Problems: No clipping-mask compositor
Required corrections: none for 1.0 layer CRUD
Final status: VERIFIED

Subsystem:
Paint engine
Claimed status: TextureBuffer + session stroke
Actual status: VERIFIED
Public API: `PaintEngine`, `dabPaintStroke` / `beginPaintStroke` / `commitPaintStroke` / `cancelPaintStroke`
Implementation files: `packages/paint/src/engine.ts`, `packages/commands/src/session.ts`, `packages/commands/src/paint-stroke.ts`
Tests: `packages/paint/tests/paint.test.ts`, `packages/commands/tests/commands.test.ts` paint undo/cancel
Headless: yes
Undo verified: tile patches restore exact bytes
Serialization verified: painted pixels in native JSON
Lifecycle verified: operation machine + `recycle()` between strokes
Disposal verified: `PaintEngine.dispose` idempotent; session cancel on dispose
Performance verified: dirty-tile originals only (no full-buffer clone)
Problems: 2D input is host-owned (correct)
Required corrections: stroke state machine, tile patches, flood-fill work limit
Final status: VERIFIED

Subsystem:
3D painting
Claimed status: roadmap
Actual status: VERIFIED
Public API: `paintSurfaceHit`, `interpolateFaceUv`, `resolveHitMaterialSlot`
Implementation files: `packages/paint/src/paint-3d.ts`
Tests: `packages/commands/tests/materials-uv-paint.test.ts`
Headless: yes (no Three.js in paint package)
Undo verified: uses same `PaintEngine` / texture command path when hosted
Serialization verified: n/a (writes pixels)
Lifecycle verified: independent of viewport
Disposal verified: n/a
Performance verified: dab is local
Problems: Host must supply hit UVs from picking
Required corrections: map face hit → UV → pixel without storing GPU objects in the document
Final status: VERIFIED

Subsystem:
Runtime adapters
Claimed status: Three.js adapter complete
Actual status: VERIFIED
Public API: `ThreeViewportAdapter`, `SceneDirtyFlag`, `resourceDiagnostics`
Implementation files: `packages/three-adapter/src/adapter.ts`, `packages/three-adapter/src/sub-element/*`
Tests: `packages/three-adapter/tests/adapter.test.ts`, `lifecycle.test.ts`
Headless: adapter uses Three.js (allowed); canonical packages do not
Undo verified: n/a (derived)
Serialization verified: n/a
Lifecycle verified: dispose twice; remount resource counts
Disposal verified: unsubscribers, geometries refcount, materials
Performance verified: material updates skip full graph rebuild; UV dirty flags do not mark topology
Problems: GPU texture upload of dirty rectangles is still host/renderer work
Required corrections: material-only sync, shared geometry refcount already present
Final status: VERIFIED

---

Architecture problems found (pre-fix):

- `ImageDocument` was a name/size stub with no tiles or layers
- `TextureSet` was a flat ID list
- `MaterialLibrary` duplicated document ownership
- Single mesh `revision` treated UV/seam/material edits as topology
- Paint strokes snapshot entire images
- Adapter treated every `document:changed` as hierarchy/full sync
- Flood fill and UV islands had no work limits
- No shared operation/resource lifecycle in core

Remaining limitations:

- Dedicated layer/texture-set commands are still thin (store writes + helpers)
- Extra UV channels are stored but not used by every operator
- Three.js dirty-region GPU upload is not implemented (no WebGL in tests)
- Worker paint jobs are not implemented (`packages/workers` triangulation only)
- Repo-wide `pnpm lint` still fails on pre-existing app/`mesh`/`tools` issues unrelated to this pass
