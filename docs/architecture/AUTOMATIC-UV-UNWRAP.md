# Automatic chart unwrap

**Feature name:** Automatic chart unwrap  
**Not:** LSCM, ABF++, or “smart” per-face projection.

This is the user-facing UV feature that charts and packs arbitrary connected meshes using xatlas via watlas. Planar, box, cylindrical, and spherical projections remain first-class.

Authoritative backend notes: [`decisions/UV-UNWRAP-XATLAS.md`](decisions/UV-UNWRAP-XATLAS.md)  
Spike evidence: [`../investigations/XATLAS-INTEGRATION-SPIKE.md`](../investigations/XATLAS-INTEGRATION-SPIKE.md)  
Tests: [`../verification/UV-UNWRAP-MATRIX.md`](../verification/UV-UNWRAP-MATRIX.md)  
Hardening: [`../roadmap/SDK-HARDENING-STATUS.md`](../roadmap/SDK-HARDENING-STATUS.md)

## Public API

```ts
projectPlanar(mesh, options)
projectBox(mesh, options)
projectCylindrical(mesh, options)
projectSpherical(mesh, options)
automaticUnwrap({ mesh, faceIds?, uvChannel?, options? })
packUvIslands(mesh, options) // existing SDK island packer
computeUvCharts(request)     // xatlas compute+pack into buffers
parameterizeUvCharts(charts) // no-op for xatlas; already parameterized
packUvCharts(request)        // re-runs generate() with pack options
```

`projectUvs({ projection: "smart" })` remains a per-face planar heuristic. It is not automatic chart unwrap.

Hosts never receive watlas or xatlas objects. The only public backend type is `UvUnwrapBackend`.

## Module responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| `pipeline` | Request options, target faces, chart compute, warnings, `prepareAutomaticUnwrap` / `automaticUnwrap` | WASM, triangulation details, command history |
| `backend/xatlas` | Lazy watlas `Initialize`, `Atlas` create/generate/pack/delete, texel→normalized UVs, xref | Canonical mesh mutation |
| `triangulation` | Temporary vertex table, per-face `triangulatePolygon`, xatlas position/index buffers, `CornerId` mapping | Editable vertices |
| `convert` | One finite UV per targeted `CornerId`, conflict rejection | Averaging, topology edits |
| `seams` | Discontinuity detection, channel-local seam flags, island flood | Splitting vertices |
| `validate` | Topology unchanged, targeted-corner coverage, selected-face overlap warning | Packing quality gates |
| `commands/automatic-unwrap` | Sparse UV + seam + pin patches, execute/undo/redo, rollback on apply failure | Running xatlas inside `execute` |

`prepareAutomaticUnwrap` is side-effect free (`apply: false`). `automaticUnwrap` and `AutomaticUnwrapCommand.execute` apply only after a complete result exists.

## Pipeline

```
canonical faces
→ temporary canonical triangulation (no new vertices)
→ xatlas input positions/indices
→ xatlas UV vertices + xref (temporary; may duplicate at seams)
→ triangle-corner UV assignment
→ canonical CornerId UVs
→ seam detection from UV discontinuities
→ island reconstruction
→ apply UVs + channel-local seams (or discard on failure)
```

Canonical topology does not change: vertex, edge, face, and half-edge IDs, face loops, materials, corner normals, and non-target UV channels stay as they were. Skin-weight maps are external to the kernel and remain valid because vertex IDs are stable. UV seams do not split editable vertices. xatlas’s duplicated output mesh is discarded after corner assignment.

## Temporary triangulation

- Triangles map through the face loop directly.
- Quads and concave n-gons use `@modeling-kit/mesh` `triangulatePolygon` (`rejectSelfIntersecting: true`), not a handwritten fan.
- Each temporary triangle stores `triangleFaceIds`, `triangleCornerIds`, and input-vertex indices.
- xatlas output vertices are never inserted into the half-edge mesh.

## Corner mapping and conversion

- Every targeted corner receives one finite UV.
- One spatial vertex may have different UVs on different corners.
- Two triangles that assign disagreeing UVs to the same `CornerId` throw `conflicting-corner-uv`. UVs are never averaged across a seam.
- Texel UVs are normalized as `u = texelU / atlasWidth`, `v = texelV / atlasHeight`.
- Canonical V increases upward (`UV_V_AXIS = "up"`, glTF / OpenGL). Hosts with top-left editors flip V for display only. xatlas may rotate charts in texel space.
- Unselected corner UV storage is not rewritten.
- Conversion, backend, validation, or cancellation failures happen before apply, or apply rolls back, so the mesh is left unchanged.

## Seams, islands, and selected faces

- Boundary edges and UV discontinuities (`UV_SEAM_TOLERANCE = 1e-6`) become seams on the **target UV channel only**.
- Continuous UVs across an interior edge do not create a seam.
- Island flood fill uses a remaining-face set. Face-loop walks are already budgeted in the mesh kernel, so corrupted loops terminate.
- Generated seams never split editable vertices.
- Selected faces are the only faces sent to xatlas, so the selection boundary is a chart boundary.
- Unselected UVs stay byte-stable. Unselected islands are not packed or moved.
- Overlap of the new `[0,1]` pack with existing unselected UV bounds emits `overlap-with-unselected`.

## Pins and UV channels

Pinned target corners reject the request (`pinned-uv`) and include the affected `CornerId` values. `ignorePins` / `pinnedUvPolicy: "ignore-with-warning"` moves them, keeps the pin flag, and warns. Pins are not silently cleared.

Default channel is `uv0`. Other channels are untouched. Manual `respectExistingSeams: true` and `preserveExistingCharts: true` throw `unsupported-option` (watlas has no seam-edge input; input UVs are per-vertex).

## Command and history

`AutomaticUnwrapCommand.prepare` computes the result with `apply: false`. `execute` snapshots targeted corner UVs, seam flags, and pin flags, then applies. Undo/redo restore that sparse patch. UV revision and seam revision are bumped so views refresh (counters are monotonic, not rewound).

Island lists are derived from UVs + seams and are not stored on the mesh. UV editor selection is session state and is not mutated by this command.

If apply throws after UV writes, both `applyAutomaticUnwrapResult` and the command restore the snapshot. Prepare/backend/conversion/validation/cancel failures never push a history entry.

## WASM and workers

- `XAtlasUnwrapBackend` does not import watlas until `initialize()`.
- Concurrent `initialize()` calls share one promise. `Initialize()` runs once per isolate. There is no `Uninitialize`.
- Each unwrap/`packUvMesh` uses `withAtlas`: `new Atlas()`, then `delete()` in `finally` (success, failure, or pre/post-generate cancel).
- `AbortSignal` is honored before/after `generate()`, not during it. Workers cancel by terminate.
- Default backend runs `generate()` on the calling thread after one WASM init.
- `WorkerPoolUnwrapBackend` + `AsyncComputePool.unwrapUvAsync` move typed arrays off-thread. Pool `dispose()` terminates workers. In-process inline pools keep the isolate-level WASM module.
- Importing `@modeling-kit/uv` or constructing a backend that is immediately disposed does not load WASM. SSR/Node import does not touch `window` / `document`.

## Packaging

| Environment | Evidence |
| --- | --- |
| Node (source) | Vitest unwrap suite + spike |
| Node packed tarball | `scripts/pack-verify.ts` fixture calls `automaticUnwrap` |
| worker_threads | Spike worker + packed `AsyncComputePool` triangulation |
| Vite / React / Vue | `apps/example-react/src/unwrap-consumer.ts`, `apps/example-vue/src/unwrap-consumer.ts` (`pnpm examples:typecheck`) |
| Browser worker | `packages/workers/tests/workers.browser.test.ts` unwrap-uv task (fake `Worker` + real xatlas in the test isolate) |
| SSR import | Node `runtime.test.ts`: no `window`; unused backend dispose never initializes |

## Distortion

`UvDistortionMetrics` is diagnostic. Invalid/non-finite UVs fail. Zero-area and flipped triangles are warnings unless a later strict policy is added.

## Known limitations

- Not exact LSCM or ABF++.
- No seam-edge constraints into xatlas.
- `parameterizeUvCharts` is a no-op; `packUvCharts` re-runs generate.
- Cancellation cannot interrupt a live `generate()`.
- Chart rotation may not preserve world-up as UV-up; V-up is the atlas texel convention after normalization.
- Browser WASM unwrap is not a headed Playwright job; CI uses Node + a fake browser worker.

## Future backends

Exact LSCM and ABF++ stay unimplemented. A later backend may use OpenABF, but that needs a maintained WASM build, Eigen, and pin constraints. Do not expose `"lscm"` or `"abf++"` names until a backend exists.
