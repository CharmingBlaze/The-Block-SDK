# Blockbench capability map (clean-room)

Research date: 2026-09-15.

**Method:** public website, wiki, README, and release notes only. No Blockbench source files were read or copied.

**Product constraint:** this SDK is a general polygonal modeling kit. Game-engine and Minecraft-specific capabilities are recorded only to **reject** them.

**Status key:** `rejected` | `design-only` | `not started` | `implemented`

Statuses below that still say `design-only` for Phases 1–7 describe the original research snapshot. Implementation has moved on: headless document/scene/mesh/commands, UVs, materials, skeleton scene nodes, LBS, and clips exist in packages. Display/Minecraft remain `rejected`. Transform gizmos and interactive knife remain incomplete.

---

## Out of scope (recorded so they are not reintroduced)

Feature: Minecraft / Bedrock / Java / OptiFine / GeckoLib formats, display mode, MoLang, skin presets, integer cube limits, 22.5° rotation snaps, flipbook “generate game code”, `.bbmodel`.

Observed behavior: Blockbench is heavily optimized as a Minecraft and game-mod authoring app. Formats gate which tools exist. Display mode stores per-slot item transforms. Animation often uses game expression languages.

Public reference: https://www.blockbench.net/wiki/blockbench/formats/ ; https://blockbench.net/wiki/guides/blockbench-overview-tips/ ; https://www.blockbench.net/wiki/docs/bbmodel/

Our independent design: none of these ship. Native versioned JSON plus glTF, OBJ, STL, PLY. Applications that need a game format write their own format package against the document model.

Major differences: no format-gated editor; one document model; extensions may add formats without changing the kernel.

Implementation status: rejected

Tests: none (must not appear in packages)

Licence/provenance notes: `.bbmodel` is Blockbench-internal; do not implement it.

---

## Application shell and UI

Feature: docked sidebars, mode tabs (Edit / Paint / Animate / Display), Electron + web app, keybinding sets named after other DCCs.

Observed behavior: the product is a full application. Tools, panels, and even available operations change with “format” and “mode”.

Public reference: https://www.blockbench.net/ ; overview wiki

Our independent design: no application shell in core. Hosts send normalized pointer/key events. Examples (playground, Vue, React) are consumers, not the SDK.

Major differences: framework-agnostic session; no mode tabs; no Blockbench layout.

Implementation status: design-only

Tests: core packages must run in Node without DOM

Licence/provenance notes: do not copy UI assets or layout.

---

## Document and project model

Feature: one project with outliner hierarchy, textures list, UV settings, animations list, format-specific flags.

Observed behavior: saving uses an internal JSON project. Convert Project changes capabilities. Per-texture UV size exists in some formats.

Public reference: wiki overview; bbmodel wiki (existence only)

Our independent design: versioned `ModelDocument` with branded IDs, entity stores, schema migrations, unknown metadata preserved. Editor session is separate (selection, tool, snap, history, playback).

Major differences: schema is ours; no format feature flags in the kernel; cuboids are mesh or primitive instances, not a parallel “Cube” type that is the only geometry.

Implementation status: design-only (Phase 1)

Tests: create / serialize / load / validate; reject cycles; preserve metadata

Licence/provenance notes: do not mirror bbmodel JSON keys.

---

## Scene graph and outliner

Feature: groups (bones when rotatable), elements (cubes, locators, meshes), parent/child, visibility, lock, reorder.

Observed behavior: animation targets groups/bones, not individual cubes, in the typical rig workflow. Locators are dimensionless references. Pivot is stored per element/group. Reparenting is a core outliner action.

Public reference: overview wiki (terminology, bones & parenting, locators)

Our independent design: typed nodes (group, mesh instance, primitive instance, empty, bone, optional camera/light, reference image, extension nodes). Operations: add, remove, reparent with world-transform preserve, reorder, duplicate, group/ungroup, hide, lock. Cycle detection.

Major differences: bones are a rigging entity that may also appear as nodes; mesh instances reference `MeshId`; no game-required bone names.

Implementation status: implemented (scene graph, reparent, bone nodes created with skeletons)

Tests: reparent preserves world transform; cycles rejected; ordered children; CreateSkeletonCommand round-trips bone nodes

Licence/provenance notes: terminology overlap (group, locator) is generic DCC language, not copied code.

---

## Cuboid / primitive modeling

Feature: cuboids with from/to size, inflate, optional zero-thickness planes, vertex-snap between cuboids, 90° rotate, flip with name heuristics, stretch in some formats.

Observed behavior: many users model entirely with cuboids. Inflate scales all axes while trying to keep UVs. Vertex snap moves/scales one cuboid so a corner coincides with another. Transform spaces: world / parent / local (wiki: Global, Bone→Parent, Local).

Public reference: overview wiki; v4.10.0 notes (stretch, parent space rename)

Our independent design: box (and other primitives) via `PrimitiveDefinition`. Cuboids can remain parametric **or** be committed to the polygon kernel. Inflate is a parametric box op, not a topology op. Vertex snap is a snapping + transform command between mesh vertices (works for any mesh, not only boxes). Flip/mirror are mesh/object commands without game left/right rename magic.

Major differences: not limited to cuboids; no integer size restriction; no 3×3×3 bound.

Implementation status: design-only (primitives Phase 5, box in first milestone)

Tests: winding, UVs, dimensions, no internal faces unless requested

Licence/provenance notes: cube primitive math is standard; write from spec, not from Cube class.

---

## Polygon mesh kernel

Feature: meshes with vertex/edge/face selection, hover highlight, seams, extrude, subdivide, merge vertices, knife, loop cut, solidify, proportional edit, auto-fix concave quads and overlapping vertices, cuboid-with-edges generator.

Observed behavior: mesh editing is first-class in generic/low-poly workflows. Knife places a cut, Enter commits, modifiers snap to texture pixels or edge/face centers. Loop cuts can run through triangle rings. glTF export triangulates and can split vertices (wiki: not round-trip friendly).

Public reference: https://www.blockbench.net/ (mesh tools); https://github.com/JannisX11/blockbench/releases/tag/v4.10.0 ; export-formats wiki (glTF triangulation)

Our independent design: editable polygon mesh with stable `VertexId` / `EdgeId` / `FaceId` / corner (loop) IDs. Preferred: half-edge or winged-edge behind a query API. Attributes on corners (UV), faces (material, smooth), edges (seam, sharp). Validation reports; optional repair returns a report. Render triangulation is derived and must not replace canonical faces.

Major differences: kernel is the product core, not an add-on to cubes. No silent auto-repair. IDs are not render indices.

Implementation status: design-only (Phase 2)

Tests: triangle, quad, n-gon, open mesh, non-manifold report, no NaN

Licence/provenance notes: topology algorithms from CG literature (Botsch et al., Blender-independent descriptions), not from Blockbench mesh_editing.

---

## Selection and picking

Feature: object selection in viewport and outliner; mesh vertex/edge/face; UV island click-select; modifiers for add/range/group; hover highlight of verts/edges.

Observed behavior: selection is interactive and format-aware. Mesh hover highlighting was improved in 4.10. Box/lasso exist in many DCCs; Blockbench mesh selection is click- and island-oriented in the UV editor.

Public reference: overview wiki (Selecting Elements); 4.10.0 notes

Our independent design: selection domains (object, vertex, edge, face, UV elements, bone, keyframe). Stable IDs. Active item vs set. Grow/shrink/loop/ring/linked. Box, lasso, paint. Topology ops return remaps. Picking lives in the Three adapter: raycast, pixel radius, front-face vs x-ray, multi-viewport, DPR, ortho/persp. No BVH forced into core.

Major differences: selection is a package, not UI checkboxes. Render mappings required for face picking after triangulation.

Implementation status: design-only (Phase 3–4)

Tests: invalid IDs dropped after delete; loop/ring on regular grids; picking maps triangle → `FaceId`

Licence/provenance notes: none

---

## Transforms, pivots, snapping

Feature: move/resize/rotate gizmos; pivot tool; transform spaces; grid; vertex snap; numeric sliders; precision modifiers.

Observed behavior: orbit navigation is host-specific. Grid resolution is user-configurable. Pivot is jointly visual and data (origin). Duplicate-and-transform is a common DCC pattern (not uniquely Blockbench).

Public reference: overview wiki (Transform Gizmos, Vertex Snap, Transform)

Our independent design: `beginTransform` / `updateTransform` / `commitTransform` / `cancelTransform`. Spaces: world, local, parent, view, normal, custom. Pivots: bounds, median, active, cursor, individual, custom. Snapping service: grid, increment, vertex, edge, midpoint, face, surface, angle, UV pixel, bbox, timeline. Preview is not history; one command on commit; cancel restores snapshot.

Major differences: Three.js TransformControls is input/visual only.

Implementation status: implemented (headless begin/update/commit/cancel; grid/increment/angle snap). Three.js TransformControls remain host-only.

Tests: drag updates do not push history; cancel restores; commit is one command; parent+child selection does not double-transform; negative scale preserved

Licence/provenance notes: none

---

## UV mapping

Feature: per-face UV vs box UV; UV editor; rotate/scale/position; mesh UV rotate handle; cycle UV; snap UV to pixels; template generation; seams.

Observed behavior: box UV auto-unwraps cuboids in a net layout and is **format-coupled** (and incompatible with meshes in some project modes). Per-face UV is the general path. Changing global texture size can be destructive in box UV.

Public reference: overview wiki UV panel; 4.10.0 UV notes; product site (auto UV + template)

Our independent design: UVs stored **per corner**. Projections: planar, box, cylindrical, spherical, smart. Islands, pack, weld/split, seams, texel density, pixel-grid snap. Optional **box projection / cuboid unwrap** as a primitive helper, not a document-wide “Box UV mode” and not a game unwrap.

Major differences: no project-global box-UV mode that disables meshes.

Implementation status: Phase 6 (projections, seams, islands, packing; LSCM deferred)

Tests: one vertex, two UV positions; pack does not require a UV viewport

Licence/provenance notes: do not port box-UV layout tables from Blockbench.

---

## Materials and painting

Feature: create/import textures; nearest filtering for pixel art; paint on 3D model and 2D UV; brush, bucket, eraser, picker, shapes, gradient, copy-paste; mirror painting; lock alpha; stroke as a unit of work; palettes; optional external editor live preview.

Observed behavior: painting is pixel-oriented and tightly tied to the UV layout. Mirror painting copies across X. Fill has multiple modes (face vs connected pixels). A stroke should not create one undo step per sample (standard paint-app expectation).

Public reference: overview wiki Paint Mode; product site Texturing Tools; 4.10.0 image editor notes

Our independent design: document materials (PBR-ish fields, filter, wrap, pixel-art flag) without storing `THREE.Material`. Texture assets with optional pixel buffer. Paint package: sampling vs application; one undo per stroke; UV-aware and optional 3D projection painting; no Canvas2D requirement in the algorithm core.

Major differences: optional package; not Minecraft texture-mcmeta.

Implementation status: Phase 6 document materials; painting deferred to Phase 8

Tests: stroke undo; symmetry; out-of-bounds UVs policy documented

Licence/provenance notes: none

---

## Rigging

Feature: bone hierarchy, pivots at joints, pose vs rest, IK mentioned in release notes, locators, optional armature/skin export to glTF.

Observed behavior: typical Blockbench rig is **rigid cuboids parented to bones**, not high-influence skinning. glTF path can export bones as a skinned armature. IK exists as a posing aid.

Public reference: overview wiki Bones & Parenting; product site Animations; 4.10.0 glTF armature notes

Our independent design: `SkeletonData` / `BoneData`, rest pose, pose transforms, N influences per vertex (default compatible with real-time engines), auto weights, normalize, mirror, validate. Rigid assignment (one bone, weight 1) as a simplified workflow. Bones also appear as `type: "bone"` scene nodes under an armature group so meshes can be parented like a typical DCC outliner. LBS remains available for glTF-style deformation.

Major differences: skinning is a first-class mesh attribute, not only group parenting of boxes.

Implementation status: implemented (skeleton scene nodes, rigid bind, LBS; IK deferred)

Tests: two-bone mesh deforms; reparent bone; weight normalize

Licence/provenance notes: linear blend skinning is standard; do not copy IK solver code.

---

## Animation

Feature: multiple clips; tracks for position/rotation/scale on bones; keyframes; linear vs smooth (bezier/catmull in notes); graph editor; markers; playback speed; loop wrapping; effect channels (particles/sounds) in game formats; optimize animation; copy keyframes when duplicating bones.

Observed behavior: evaluation is timeline-based. Interpolation types are user-visible. Effect animators are game-oriented.

Public reference: overview wiki Animate Mode; 4.10.0 animation section

Our independent design: clips with typed tracks on stable IDs (bones, objects, visibility, custom numbers). Constant, linear, cubic, quaternion slerp. Copy/paste, scale time, reverse, markers, playback, scrub, auto-key, rest-pose compare. Evaluator is headless. Three adapter may build `THREE.AnimationClip` for preview only. No particle/sound game events in core (hosts may add custom tracks).

Major differences: no MoLang; no animation controllers from Bedrock.

Implementation status: Phase 7 (clips, interpolation, playback; glTF file export in Phase 8)

Tests: interpolation golden values; undo keyframe move; round-trip native JSON

Licence/provenance notes: none

---

## Commands, undo, events

Feature: undo/redo around edits; plugin example uses begin/finish edit around mutating selected cubes; backups on a timer in the app.

Observed behavior: the app treats undo as an editor concern. Drags that generate many undos would be a UX failure. Plugins mutate globals then `updateView`.

Public reference: plugin wiki (behavior: undo wraps an edit); overview backups (app concern)

Our independent design: every persistent edit is a `Command` with execute/undo/redo, merge, transactions, drag coalescing, cancel/rollback, save-point dirty flag. Typed events batched in transactions. No DOM. Subscriber errors isolated.

Major differences: no global `Undo` / `Canvas`; session-owned history.

Implementation status: design-only (Phase 3)

Tests: undo+redo identity; one drag = one entry; cancel restores

Licence/provenance notes: do not clone Undo.initEdit / finishEdit API.

---

## Formats and interchange

Feature: export OBJ, glTF/GLB, FBX, DAE; import OBJ with MTL and scale (4.10); glTF triangulates and splits vertices; pixel-art filtering on glTF materials; optional embed textures and animations.

Observed behavior: artists use glTF for engines (Godot, etc.) and OBJ as a limited mesh dump. FBX is proprietary and painful. DAE is an interchange option.

Public reference: https://www.blockbench.net/wiki/guides/export-formats/

Our independent design: format registry. Phase 8: native JSON, glTF/GLB, OBJ, STL, PLY. Importers return warnings. Exporters list lost/converted features, units, coordinates. **No FBX or DAE in the first line** unless an independently licensed library is approved later. **No `.bbmodel`.**

Major differences: interchange is not the native document; native JSON keeps quads, IDs, extra attributes.

Implementation status: design-only (Phase 8; native JSON earlier for milestone)

Tests: round-trip native; glTF export then import with documented loss (triangulation)

Licence/provenance notes: implement from Khronos/Wavefront specs or MIT/Apache libraries, never from Blockbench codecs.

---

## Three.js viewport

Feature: Blockbench is a Three.js application: scene graph, picking, gizmos, texture preview, GIF recorder, multiple view presets.

Observed behavior: the renderer and the model are tightly coupled in an app (updateView after edits). Multiple camera presets exist. GPU resources must be disposed (general WebGL concern).

Public reference: product site; README (web + Electron)

Our independent design: `ThreeViewportAdapter` maps document → Object3D / BufferGeometry / materials. Host owns renderer, camera, canvas, input. Multiple adapters per session. Incremental dirty sync. Overlay data (selection, grid, cursor, previews) in screen space. Dispose on replace.

Major differences: adapter does not own the document; no Dockview/Electron.

Implementation status: design-only (Phase 4)

Tests: four viewports; triangle pick → face id; dispose releases geometries

Licence/provenance notes: Three.js is MIT; do not copy Blockbench shaders/helpers.

---

## Extensions

Feature: JS plugins register actions, formats, codecs; tightly coupled to host globals; plugin store.

Observed behavior: extensions expect a running Blockbench instance.

Public reference: https://www.blockbench.net/wiki/docs/plugin/

Our independent design: register commands, tools, primitives, node types, material models, importers/exporters, validators, document metadata keys, animation track types. Disposable. No panel implementation in core (hosts may read metadata).

Major differences: no `Plugin.register` compatibility layer.

Implementation status: design-only (later phases; registry stubs in Phase 1 if needed)

Tests: register and remove a command without leaking listeners

Licence/provenance notes: none

---

## Problems in the reference product to avoid

- Global mutable project, undo, and canvas objects
- Format flags that delete or hide modeling capabilities
- Three.js / UI as the place edits happen
- Native file format that is undocumented and app-private
- Auto-repair without a report
- Export formats that silently triangulate without a loss report
- Cuboid-only ID and UV systems that cannot represent general meshes
