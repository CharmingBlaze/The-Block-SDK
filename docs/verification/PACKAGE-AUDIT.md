# The Block SDK: Package-by-Package Code Audit

Repository: https://github.com/CharmingBlaze/The-Block-SDK  
Audited commit: `3777e45`  
Audit scope: all packages under `packages/`  

## Verdict

The SDK contains a substantial modeling foundation, but it is not ready to be treated as a dependable 1.0 SDK. The normal-path test suite is healthy, but difficult topology, failure recovery, public-package consumption, attribute preservation, visibility-aware selection, real worker execution, and production rigging/animation remain incomplete or incorrect.

The most urgent corrections are:

1. Make history undo, redo, transactions, and saved-state tracking failure-safe.
2. Harden `MeshBuilder` and all mesh operators against invalid and non-manifold input.
3. Replace fan triangulation with deterministic concave-polygon triangulation.
4. Replace the sequential bevel implementation with a planned multi-edge bevel.
5. Centralize propagation of UVs, normals, colors, seams, creases, material slots, and skin weights.
6. Correct object selection, edge-ring traversal, marquee selection, and occlusion behavior.
7. Correct vertex/object pivots and oriented scaling.
8. Fix paint undo patches for strokes crossing multiple tiles.
9. Consolidate the two incompatible animation schemas.
10. Replace the in-process timer scheduler with actual browser and Node workers.
11. Standardize package exports and prove packages through tarball consumer tests.

## Severity definitions

| Severity | Meaning |
|---|---|
| Critical | Can corrupt state, lose undo information, produce invalid topology, or make a published package unusable. |
| High | Common SDK behavior is incorrect, silently incomplete, or loses user data. |
| Medium | API contract, validation, interoperability, or performance needs correction before 1.0. |
| Low | Cleanup, diagnostics, documentation, or maintainability correction. |

## 1. `@modeling-kit/core`

### Confirmed corrections

| Severity | Problem | Required correction |
|---|---|---|
| Medium | `createIdFactory()` depends exclusively on `crypto.randomUUID()`. Some embedded WebViews, test runners, and older runtimes do not provide it. | Allow an injected ID source everywhere and provide a documented portable fallback or explicit runtime requirement. |
| Medium | Event listeners swallow every exception without logging or diagnostics. This prevents one listener from breaking editor state, but it also hides adapter and plugin defects. | Send listener failures to an optional diagnostic/error handler while continuing remaining listeners. |
| Medium | `DirtyBatcher` stops after eight passes while retaining pending flags, but does not report that the convergence limit was reached. | Return a flush result or emit a diagnostic containing pending flags and pass count. |
| Medium | Production lifecycle machines silently return `false` on illegal transitions, while development throws. Callers frequently ignore the boolean. Production and development can therefore diverge. | Use one predictable contract: throw typed errors, return a required `Result`, or enforce checked transitions at call sites. |
| Low | Resource diagnostics decrement by clamping at zero, hiding double-disposal and counter imbalance. | In development, report underflow as a diagnostic or assertion. |

### Required tests

- Listener failure diagnostic without stopping later listeners.
- Dirty batcher convergence-limit reporting.
- Identical lifecycle semantics in development and production modes.
- ID generation in browser, Node, embedded WebView, and injected deterministic environments.

## 2. `@modeling-kit/math`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Matrix decomposition of transforms containing negative scale, reflections, or shear is not proven by the current tests. Reparenting and world/local conversion depend on it. | Add property tests against Three.js or another reference implementation for valid TRS matrices, including negative and non-uniform scale. Explicitly reject or document shear loss. |
| Medium | Matrix inversion checks `det === 0` rather than using a scale-aware epsilon. Nearly singular transforms can produce extreme or non-finite output. | Use a documented determinant tolerance and return/throw `SingularTransformError`. |
| Medium | Quaternion construction does not normalize values automatically, while several consumers assume rotations are normalized. | Normalize at storage boundaries and validate before interpolation and matrix construction. |
| Medium | `Quaternion.fromAxisAngle()` and `fromTo()` depend on normalizing nonzero vectors but do not provide domain-specific error messages for zero axes. | Validate axes and report typed geometry errors. |
| Low | There is only one math test file for vectors, matrices, quaternions, Euler conversion, rays, and bounds. | Add randomized round-trip and reference-comparison tests. |

### Required tests

- `compose -> decompose -> compose` property tests.
- Inverse multiplication near singularity.
- Negative-scale parent/child world transforms.
- Quaternion slerp for antipodal, nearly identical, and invalid quaternions.
- Ray/AABB boundary and zero-direction cases.

## 3. `@modeling-kit/mesh`

### Critical and high corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | `MeshBuilder.addVertex()` and `addFace()` silently overwrite caller-supplied duplicate IDs. Partial half-edges and corners can remain after a duplicate face ID. | Reject duplicate IDs before mutation. |
| Critical | `MeshBuilder.addFace()` does not prevalidate missing vertices, repeated vertices, zero area, attribute lengths, duplicate directed edges, or a third face on an edge. | Add a complete preflight validator and make face insertion transactional. |
| Critical | Concave n-gons are triangulated with a fan. This can create triangles outside the polygon and break rendering, picking, and exports. | Implement deterministic projected ear clipping, winding detection, collinear cleanup, and self-intersection diagnostics. |
| Critical | `triangulateFaces()` uses the same fan strategy and can write incorrect editable topology. | Reuse the canonical triangulator used by derived rendering. |
| High | Topology operators inconsistently preserve corner and edge attributes. Bevel and triangulate lose named UV channels, pins, colors, custom normals, seams, creases, `materialSlotId`, and future attributes. | Create one attribute propagation service used by every topology operator. |
| High | Bevel interprets offset as a clamped percentage from `0.05` to `0.45`, not a world-space distance. Negative and zero offsets still bevel. | Add explicit `offset` and `percent` modes with strict parameter validation. |
| High | Multi-edge bevel processes selected edges sequentially and silently skips an edge deleted by an earlier step. | Plan and execute the entire connected bevel network in one transaction. |
| High | Bevel does not implement robust corner miters, boundary bevel, overlap clamping, profile control, or consistent multi-segment geometry. | Redesign it as a network operator with explicit junction strategies. |
| High | Directly exposed mesh maps allow mutations that bypass revision counters and invariant checks. | Encapsulate maps behind read-only views and mutation APIs, or clearly designate an unsafe internal layer. |
| Medium | Several operations rebuild large parts of the mesh from snapshots, increasing cost and risking ID/attribute churn. | Move toward localized half-edge edits after correctness is established. |

### Required invariant suite

Run after every topology operator:

- Every face loop closes.
- Every half-edge has valid next/previous links.
- Twin links are symmetric.
- Every corner references its face and origin vertex.
- Every edge has one or two valid half-edges in manifold mode.
- No duplicate directed edges.
- Vertex outward pointers are valid.
- All positions and attributes are finite.
- Topology mapping references only before/after-live IDs.
- Undo restores a byte-stable serialized mesh.

Add property tests for random valid disks, grids, cubes, cylinders, boundaries, poles, concave n-gons, and operator sequences.

## 4. `@modeling-kit/validation`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Validation relies on public query functions that can terminate early or throw on severely corrupted topology. A validator must be able to diagnose corruption rather than crash. | Add guarded raw-record validation before higher-level traversal. |
| High | It does not comprehensively verify half-edge next/prev reciprocity, twin reciprocity, corner ownership, face representative half-edges, vertex representative half-edges, duplicate directed edges, or orphaned records. | Add explicit structural invariant checks for every record table. |
| High | Face degeneracy checks cover vertex count and consecutive duplicates but not polygon area, repeated nonconsecutive vertices, self-intersection, or severe non-planarity. | Add geometric face validation with tolerance-controlled diagnostics. |
| Medium | A fixed global epsilon is used instead of mesh-operation tolerance or scale-aware tolerance. | Accept `GeometryTolerance` and support scale-aware thresholds. |
| Medium | Inconsistent winding is only a warning even when strict manifold tools depend on orientation. | Make severity configurable by validation mode. |
| Medium | `isManifold` only reflects two error codes and can remain true for other structural corruption. | Define manifold validity from all relevant structural checks. |

## 5. `@modeling-kit/document`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | `beginDocumentTransaction()` snapshots only the scene graph and revisions, not meshes, materials, textures, texture sets, images, skeletons, animations, or instances. Rollback can leave resource mutations applied. | Rename it to a scene transaction or implement complete document snapshots/change journals. |
| High | `groupNodes()` and `ungroupNode()` mutate incrementally without transactional rollback. A failure leaves a partial hierarchy. | Prevalidate all nodes and execute in a transaction. |
| High | `duplicateHierarchy(..., {mesh: "independent"})` shallow-copies the mesh record; nested serialized kernel data can remain shared. | Deep-clone the kernel and metadata and verify independent editing. |
| High | Resource usage indexing omits modern texture bindings and texture-set channel references, so cleanup can delete referenced textures. | Centralize reference traversal across all resource-bearing fields. |
| High | `EntityStore.get()` and iterators return mutable entity references. Direct modification bypasses store and document revisions. | Return immutable data, freeze in development, or require mutation through store methods. |
| Medium | Reparenting through matrix decomposition can lose shear introduced by non-uniform scaled parents. | Reject unsupported shear with a diagnostic or adopt matrix-backed local transforms. |
| Medium | `restoreNode()` records replacement as an addition and appends restored children rather than guaranteeing original sibling order. | Provide explicit restore metadata with original parent/index and correct change kind. |
| Medium | Material and animation normalization often repairs malformed input silently with defaults. | Add strict and repair parsing modes with structured diagnostics. |
| Medium | Unknown metadata is shallow-copied; nested mutable values remain shared. | Define metadata immutability and deep-clone/structured-clone policy. |

## 6. `@modeling-kit/scene`

This package mainly re-exports document scene APIs, so it inherits document hierarchy defects.

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Medium | The package implies a separate scene subsystem while ownership actually lives in `document`. | Document this explicitly or fold the thin re-export into the canonical package. |
| Medium | Re-export boundaries can encourage consumers to mutate the same system through multiple conceptual APIs. | Publish one canonical scene API surface and mark compatibility exports. |
| Low | Add package-level contract tests so future re-exports cannot diverge from document behavior. | Test every intended export and type boundary. |

## 7. `@modeling-kit/history`

### Critical corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | Undo pops a command before `undo()` succeeds. A thrown undo loses the command and may leave partial state. | Peek, execute, then move the command only after success. |
| Critical | Redo pops before success and has the same corruption path. | Use success-committed stack movement. |
| Critical | Dirty tracking compares undo-stack length with a saved index. Save → undo → execute a different command can incorrectly report clean. | Track a history-state identity/generation, invalidating the saved marker on branch replacement. |
| Critical | Transaction rollback pops the transaction before all undo steps succeed. | Retain a recoverable transaction record and report partial rollback explicitly. |
| High | Composite rollback can itself throw and mask the original command failure. | Aggregate original and rollback errors and retain recovery information. |
| Medium | Trimming history clamps a lost save point to zero, which can later report a false clean state. | Represent an unreachable saved state explicitly. |
| Medium | Merge operations can cross the saved-state boundary and alter the command representing the saved state. | Disable merging across save markers or update state identity correctly. |

## 8. `@modeling-kit/commands`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | Command correctness depends on the broken history failure semantics. | Correct history first, then add failure injection to every command family. |
| High | Many topology commands store full before/after mesh snapshots. This is safe for basic undo but memory-heavy for large assets. | Retain snapshots for correctness initially, then add measured delta-based storage where needed. |
| High | Command families do not uniformly validate target existence, locks, effective selectability, or resource ownership before mutation. | Add shared command precondition helpers and typed capability failures. |
| High | Transform commands silently skip vertices that disappear rather than reporting stale command state. | Reject stale patches or return structured recovery diagnostics. |
| Medium | Some commands emit multiple revision/event updates for one logical action. | Batch document/mesh changes and emit one structured change set. |
| Medium | Resource commands should be tested for reference cleanup, undo ordering, and redo after dependent resources change. | Add cross-resource command tests. |
| Medium | `crypto.randomUUID()` is used directly by commands instead of the session ID factory. | Use injected command ID generation for deterministic tests and portable runtimes. |

## 9. `@modeling-kit/selection`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | `add`, `remove`, and `toggle` always mutate `elementIds`; object-domain selection uses `objectIds` and is therefore broken. | Make mutations domain-aware and separately type object/component IDs. |
| High | Edge-ring selection only finds opposite edges in immediately adjacent quads. It does not traverse the ring. | Implement bounded ring traversal until boundary, pole, non-quad, or closure. |
| High | Box/lasso selection only checks projected vertices. Crossing edges and enclosing/intersecting faces can be missed. | Implement point, segment, and polygon intersection with touch/center/contain modes. |
| High | `xray: false` box selection chooses the first matching face by iteration order, not the nearest visible face. | Require depth/raycast visibility information from the viewport. |
| High | Lasso ignores occlusion entirely. | Add the same visibility backend used by box selection. |
| Medium | Front-facing filtering applies only to faces; vertex and edge visibility remains unresolved. | Define front/visible rules for all component domains. |
| Medium | Active element behavior after remaps and multi-object selection needs stronger invariants. | Preserve or deterministically replace active IDs using topology mapping. |

## 10. `@modeling-kit/snapping`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Face snapping targets only the arithmetic centroid, not the nearest point on the face. | Separate `face-center` and `face-surface`; use closest-point-on-triangle/polygon queries. |
| High | Priority is sorted before distance, so a distant high-priority target can beat an exact lower-priority target. | Use screen-space distance with a controlled priority bias and per-type thresholds. |
| High | All queries are brute force. Large meshes will stall pointer movement. | Add an incremental spatial index/BVH interface for vertices, edges, and triangles. |
| Medium | Radius defaults are world-space mesh fractions, so snapping changes with model scale and camera zoom. | Accept viewport projection and pixel-radius configuration. |
| Medium | Hysteresis matches only target ID, which is ambiguous when multiple target types share an ID. | Track `(targetType, targetId)` and prior screen position. |
| Medium | Grid snapping rounds all three axes without a working-plane abstraction. | Add active construction plane and constrained-axis grid snapping. |

## 11. `@modeling-kit/transform`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Vertex pivot modes calculate from object origins instead of selected vertex positions. | Compute world-space median, bounds, active element, individual origins, and cursor pivot from selected components. |
| High | Object bounds pivot uses selected object origins rather than geometry bounds. | Union transformed mesh bounding boxes. |
| High | Active pivot uses the first root instead of `SelectionManager.activeId`. | Pass active selection explicitly. |
| High | Scaling ignores world/local/parent/view/normal orientation. | Apply `R * S * R^-1` around the pivot. |
| High | Vertex transforms support one object/mesh path and take the first object ID. | Define multi-object edit behavior and per-object world/local conversion. |
| Medium | Normal-space transforms accept one supplied normal rather than deriving a stable selection normal. | Compute face/vertex/edge orientation from the active or averaged selection. |
| Medium | Singular parent transforms can fail midway through a multi-object gesture. | Preflight all selected roots before any preview mutation. |
| Medium | Bounds and orientation caches should be revision-aware to keep interactive gestures fast. | Add geometry bounds cache keyed by position/topology revisions. |

## 12. `@modeling-kit/input`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Pointer cancellation only releases a button when `packet.button` is present. Normal pointer-cancel packets can leave held-button state stuck. | Clear all buttons associated with the cancelled pointer or reconcile from `buttons`. |
| Medium | Wheel input updates zoom but reports `consumed: false`, allowing the browser page to scroll while zooming the viewport. | Make consumption configurable and return `preventDefault` when a viewport owns zoom. |
| Medium | Pointer delta is shared globally rather than tracked per pointer. Multi-touch/stylus transitions can create jumps. | Track last positions and deltas per pointer ID. |
| Medium | Pen pressure retains the last value and can be exposed during mouse tracking. | Reset pressure per pointer lifecycle and distinguish mouse pressure semantics. |
| Medium | Context push allows duplicates and pop removes only the last matching occurrence through a filter-by-index. | Use context tokens/scopes so ownership and cleanup are deterministic. |
| Low | Default bindings are too small to constitute a complete modeler input map. | Keep defaults minimal but document host responsibility and provide comprehensive examples. |

## 13. `@modeling-kit/tools`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | `ToolManager.register()` silently overwrites a tool with the same ID without disposing or rejecting the previous tool. | Reject duplicates or define an explicit replace operation. |
| High | Gesture update/commit/cancel do not verify that the active tool owns the coordinator claim for the pointer. | Require and validate a gesture/claim token. |
| High | Tool activation aborts the current tool before confirming the new tool can activate successfully. A thrown activation can leave no valid active tool. | Use transactional activation with recovery to the prior tool or a known neutral tool. |
| Medium | `InteractionCoordinator.dispose()` only clears state and is also used as a reset operation. The name obscures lifecycle intent. | Split `reset()` from terminal `dispose()`. |
| Medium | Modal bevel exposes the same clamped percentage semantics as the kernel bevel. | Update after the bevel API redesign. |
| Medium | Modal tools need stale-topology detection between preview and commit. | Store source revisions and reject/replan stale commits. |

## 14. `@modeling-kit/primitives`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Primitive correctness is validated mainly by count/manifold checks; all generators need orientation, normal, UV seam, degeneracy, and extreme-parameter tests. | Add a parameter matrix for every primitive. |
| High | Primitive construction inherits unsafe `MeshBuilder` behavior. | Correct the kernel builder and run validation after generation in development/test builds. |
| Medium | Segment/count parameters need documented upper limits to prevent accidental huge allocations. | Add configurable complexity budgets and typed limit errors. |
| Medium | UVs use a mixture of projections and generator-specific mappings; seam placement and texel density are not standardized. | Define primitive UV conventions and verify them. |
| Medium | Architecture primitives need collision/overlap rules for invalid dimensions such as openings exceeding walls. | Validate relationships, not just positive scalar inputs. |
| Low | `generateDisc` and `generateCircle` appear as duplicate exports. | Choose one canonical name and retain the other only as a documented alias. |

## 15. `@modeling-kit/materials`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Two overlapping material schemas exist in `document` and `materials`, including modern fields and legacy aliases. Keeping dual fields synchronized is fragile. | Select one canonical stored schema and generate compatibility views at the boundary. |
| High | `MaterialLibrary` returns mutable material and instance objects. External mutation bypasses revision/cache invalidation. | Return immutable snapshots or freeze/copy returned data. |
| High | Deleting a parent material leaves dependent instances present and unresolved. | Reject deletion, cascade explicitly, or detach instances transactionally. |
| Medium | Instance overrides use broad intersected partial types, allowing incompatible PBR/unlit fields at compile time. | Use discriminated instance override types based on parent material kind. |
| Medium | Texture binding validation does not validate binding IDs, tuple lengths, nonzero/valid scale, color spaces for all channels, strength ranges, or `enabled`. | Expand schema validation and cross-check referenced resources. |
| Medium | Conversion can lose legacy texture fields and aliases depending on direction. | Add canonical round-trip tests covering every field. |

## 16. `@modeling-kit/uv`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | Commit behavior restores baseline before `onCommit`; observer or asynchronous callbacks can report success while leaving original UVs applied. | Separate command application from post-commit observation or keep final state applied. |
| High | The advertised smart unwrap is per-face planar projection, not seam-based LSCM/ABF. | Keep the label explicit and implement a real unwrap before presenting it as automatic unwrap. |
| High | Packing is a basic shelf algorithm with no rotation, pinned-island support, UDIMs, texel density, grouping, or overlap diagnostics during placement. | Define 1.0 scope honestly and add a production packer later. |
| Medium | Packing does not validate negative/non-finite padding or non-finite UV input. | Add strict validation and transactional rollback. |
| Medium | UV transform updates accept non-finite delta, scale, angle, and pivot values. | Validate all interactive inputs before mutating UVs. |
| Medium | Cache correctness depends on revision discipline that direct mesh-map mutation can bypass. | Encapsulate mesh mutations or add debug fingerprints/assertions. |
| Medium | Pinned-corner pivot calculation excludes pins, which may be surprising when pins are part of the selected island. | Define pivot behavior explicitly and expose include/exclude policy. |

## 17. `@modeling-kit/paint`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | `strokeTo()` captures only endpoint tiles. A line crossing intermediate tiles changes pixels that are absent from undo patches. | Capture the complete expanded line bounds or hydrate all missing changed tiles from the baseline. |
| High | Every stroke copies the entire texture into a baseline, defeating sparse tile memory behavior. A 4096² RGBA image copies about 64 MB per stroke. | Use lazy tile capture and optional compressed/delta checkpoints. |
| High | Cancellation is correct through the full baseline, but commit/undo can disagree because patch coverage differs from rollback coverage. | Make one tile-journal source authoritative for cancel, commit, undo, and redo. |
| Medium | Brush input validation must reject non-finite coordinates, size, opacity, hardness, spacing, and color values. | Add one brush-options validator used by all raster paths. |
| Medium | Flood-fill and dilation need hard work budgets/cancellation for large textures. | Add iterative budget checkpoints and worker support. |
| Medium | Paint patches should carry texture revision/source dimensions to reject stale application. | Add revision and shape preconditions. |

## 18. `@modeling-kit/rigging`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | Multi-bone cycles can produce no roots and return an empty skeleton without an error. | Perform full graph validation and cycle detection before building. |
| High | Duplicate bone IDs silently overwrite prior records. | Reject duplicate IDs. |
| High | Missing parents silently convert bones to roots. | Reject in strict mode; repair only with diagnostics. |
| High | `reparentBone()` does not reliably reject missing source or parent IDs. | Validate both IDs and the complete graph. |
| High | Skinning skips missing influences without renormalizing valid weights; vertices can collapse toward `(0,0,0)`. | Validate first, renormalize valid influences, or preserve rest position on invalid bindings. |
| High | Weight normalization accepts negative, non-finite, duplicate, and zero-limit influences. | Sanitize/combine/reject before normalization. |
| Medium | Nearest-bone weighting uses bone origins only, not bone segments or heat/distance volumes. | Document it as a primitive fallback and add segment-distance weighting. |
| Medium | Rigging has no topology-remap integration for weights after split, merge, bevel, subdivide, or delete. | Add skin-weight propagation to canonical topology mapping. |

## 19. `@modeling-kit/animation`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | Two incompatible animation schemas coexist: `translation/STEP/LINEAR/CUBICSPLINE` and `position/constant/linear/cubic`. | Choose one canonical document/runtime schema and migrate compatibility data at boundaries. |
| High | `CUBICSPLINE` in the older sampler silently behaves as linear and does not support tangent triplet layout. | Implement Hermite cubic spline correctly or reject it. |
| High | Tracks are not consistently validated for sorted finite times, matching value counts, valid quaternions, duplicate target channels, and valid targets. | Add strict clip validation and normalization. |
| High | The runtime/document evaluator split risks different animation results for the same clip. | Keep one evaluator and one set of interpolation functions. |
| Medium | Cubic numeric interpolation uses Catmull-Rom while the public terminology can imply authored tangents. | Name interpolation precisely and store its required tangent data. |
| Medium | Visibility tracks are present in the document schema but absent in the older runtime schema. | Consolidate channel support. |
| Medium | Reverse/time-scale helpers should deep-copy key values and validate marker bounds. | Ensure immutable transformed clips. |

## 20. `@modeling-kit/formats`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | glTF export inherits incorrect fan triangulation for concave n-gons. | Use the corrected canonical triangulator. |
| High | glTF export omits textures, images, samplers, skins, weights, joints, and animations. | Implement or report every omitted feature in structured data-loss output. |
| High | Empty mesh export can write infinite min/max values that serialize to `null`, producing invalid glTF. | Skip empty primitives or emit a valid explicit policy. |
| High | glTF import welds by position only, potentially merging hard-normal, UV, color, material, and skin discontinuities. | Make welding attribute-aware and configurable. |
| High | Invalid accessor ranges often produce zeros instead of hard errors, turning corrupt files into origin geometry. | Add strict buffer, stride, alignment, component, and index bounds checks. |
| High | OBJ and STL accept non-finite coordinates. | Reject malformed numeric tokens before building geometry. |
| Medium | OBJ is described as geometry-only but does not preserve UVs despite OBJ supporting them. | Either implement `vt` per-corner import/export or report this explicitly. |
| Medium | STL import creates triangle soup with no optional welding. | Offer tolerance-based welding as an explicit import option. |
| Medium | Cancellation checks are coarse and cannot interrupt large synchronous inner loops promptly. | Add periodic checks or worker execution. |
| Medium | Conversion reports are incomplete for material textures, animation, skinning, normals, tangents, colors, and extensions. | Generate reports from actual source/target capability comparison. |

## 21. `@modeling-kit/workers`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | `AsyncComputePool` uses `setTimeout`; computation still runs on the main thread. It is not a worker pool. | Implement browser `Worker` and Node `worker_threads` backends with an in-process fallback explicitly named as such. |
| High | Abort cannot interrupt triangulation, validation, or UV packing after synchronous computation begins. | Use workers or cooperative checkpoints. |
| High | Disposal resolves pending requests with ID `"disposed"` instead of their original request IDs. | Store request metadata per pending task and preserve correlation IDs. |
| High | There is no concurrency limit, queue priority, transfer-list use, crash recovery, timeout, or stale-result routing. | Implement a bounded scheduler and generation/revision validation. |
| Medium | `defaultComputePool` is a disposable global singleton; one consumer can permanently dispose shared service state. | Prefer host-owned pools or a resettable provider. |
| Medium | Serialized typed-array data is copied rather than transferred. | Use transferable buffers where safe. |

## 22. `@modeling-kit/three-adapter`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| High | CPU raycasting and brute-force sub-element queries will not scale to production mesh sizes. | Add BVH-backed spatial queries and retain CPU fallback. |
| High | Derived rendering inherits invalid concave triangulation. | Consume corrected triangulation output. |
| High | Material/texture support is incomplete; resource diagnostics report zero runtime textures regardless of actual future texture use. | Implement and track texture caches, ownership, and disposal. |
| Medium | `createThreeViewport()` creates a perpetual render loop even when nothing changes or the viewport is hidden. | Add demand rendering, pause/resume, and visibility handling. |
| Medium | Device pixel ratio is unbounded, which can create excessive framebuffer cost on high-DPI displays. | Add configurable DPR cap. |
| Medium | The turnkey viewport hardcodes perspective camera and OrbitControls behavior. | Support orthographic cameras and host-supplied controls/camera policies. |
| Medium | Middle mouse is configured as dolly rather than pan in the turnkey viewport. | Make button mapping configurable; align defaults with the host modeler. |
| Medium | WebGL context loss/restoration is not handled. | Add context lifecycle handling and resource rebuild tests. |
| Medium | Tests use stub renderers and do not prove actual WebGL resource disposal or shader/material compatibility. | Add browser integration tests with real Three.js/WebGL where CI permits. |

## 23. `@modeling-kit/sdk`

### Corrections

| Severity | Problem | Required correction |
|---|---|---|
| Critical | Most workspace package manifests export TypeScript source instead of compiled `dist`, making normal Node/package consumption unreliable. | Export compiled JavaScript and declarations only. |
| Critical | Clean `pnpm typecheck` fails because source path mappings are incomplete; a prior build can hide the failure. | Centralize workspace paths or use project references and prove clean-checkout order. |
| High | The facade re-exports overlapping legacy and canonical APIs, including dual animation/material concepts. | Define a small stable 1.0 surface and move compatibility APIs under explicit subpaths. |
| High | AI tool schemas cover only a subset of editor capability and rely on permissive runtime coercion in places. | Version schemas, use structured error codes, validate IDs and current capabilities, and reject stale context. |
| High | The fluent API can imply an operation succeeded without exposing warnings and topology diagnostics. | Return operation results or provide a required diagnostics channel. |
| Medium | Headless facade behavior is tested, but packed-tarball behavior is not. | Pack all public packages, install them into clean Node/Vite consumer fixtures, then typecheck and execute. |
| Medium | Package versions, licenses, `files`, `exports`, ESM/CJS policy, and entry points are inconsistent. | Standardize manifests through a generator/check script. |
| Medium | `@modeling-kit/validation` advertises a CommonJS file that its build does not produce. | Remove the `require` condition or build CJS. |

## Cross-package architectural corrections

### A. Establish one canonical ownership model

| Concern | Canonical owner |
|---|---|
| Mesh topology and attributes | `mesh` |
| Mesh validation and repair diagnostics | `validation` |
| Document resources and hierarchy | `document` |
| Undoable user mutations | `commands` + `history` |
| Selection state | `selection` |
| Interactive tool state | `tools` |
| Stored animation schema | `document` |
| Animation evaluation | `animation` |
| Stored materials | `document` with `materials` as behavior/validation |
| Rendering resources | `three-adapter` |
| Background execution | `workers` |

Remove or isolate duplicate schemas and compatibility aliases.

### B. Make every mutation return structured information

All editing operations should return:

```ts
interface OperationResult<T> {
  ok: boolean;
  value?: T;
  warnings: Diagnostic[];
  errors: Diagnostic[];
  changes?: ChangeSet;
  topology?: TopologyMapping;
}
```

Avoid silent skips, silent clamping, and silent repair in professional APIs.

### C. Add a universal attribute propagation layer

Topology operators must handle:

- All UV channels.
- UV pins.
- Corner normals.
- Corner colors.
- Material slots and slot IDs.
- Edge seams.
- Edge crease/sharp values.
- Skin weights.
- Future custom attributes.

Do not implement attribute copying independently in every operator.

### D. Add a difficult-topology corpus

Store canonical fixtures for:

- Concave polygons.
- Holes and multiple boundaries.
- Non-planar n-gons.
- Bow-tie/self-intersecting faces.
- Boundary strips.
- Poles of valence 3, 5, and higher.
- Disconnected components.
- Intentional non-manifold input.
- UV seams and multiple UV channels.
- Skinned meshes.
- Material boundaries.

Run every relevant operator against the corpus and validate invariants before and after undo/redo.

### E. Correct the release gate

Use a clean checkout and run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm examples:typecheck
pnpm lint
pnpm test
pnpm build
pnpm arch:check
pnpm pack:verify
```

`pack:verify` should:

1. Pack every public package.
2. Inspect tarball contents.
3. Install tarballs into clean Node ESM, TypeScript, Vite, Vue, and React fixtures.
4. Run imports for every documented subpath.
5. Verify headless imports do not load DOM or Three.js.
6. Verify Three.js imports work only through their optional entry points.

## Recommended correction phases

### Phase 1: State safety

- History stack failure behavior.
- Dirty/save-state identity.
- Document/group transaction safety.
- Object selection storage.
- Paint patch completeness.

### Phase 2: Kernel correctness

- Builder validation.
- Concave triangulation.
- Structural validator.
- Central attribute propagation.
- Difficult-topology corpus.

### Phase 3: Modeling behavior

- Multi-edge bevel redesign.
- Edge-ring traversal.
- Marquee geometry and visibility.
- Professional snapping.
- Correct pivots and transform spaces.

### Phase 4: Assets and animation

- Canonical material schema.
- Canonical animation schema.
- Skeleton graph validation.
- Weight propagation across topology.
- Full data-loss reporting.

### Phase 5: Runtime and distribution

- Actual worker backends.
- BVH spatial queries.
- Three.js context/resource integration tests.
- Compiled package exports.
- Tarball consumer verification.
- Accurate release evidence.

## Definition of ready for 1.0

Do not mark the SDK 1.0-ready until all of the following are true:

- A clean checkout passes the complete release gate.
- Published tarballs work in clean consumers.
- Undo/redo remains valid after injected command failures.
- Every topology operator preserves declared attributes or reports explicit loss.
- Concave n-gons render, pick, triangulate, and export correctly.
- Random operator sequences preserve mesh invariants.
- Object/component selection behaves correctly in all domains.
- Transform pivots and spaces match documented semantics.
- Paint strokes undo completely across tile boundaries.
- Skeleton cycles and invalid weights are rejected.
- One canonical animation schema is used end-to-end.
- Heavy work can execute off the UI thread.
- Documentation and evidence match reproduced behavior.
