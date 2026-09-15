# Headless UV, Image, and Painting SDK — historical notes

**Not the master specification and not completion evidence.** Checkboxes below are unverified historical notes.

Authoritative requirements: [`modeling-operator-specification.md`](modeling-operator-specification.md)  
Evidence: [`../verification/RELEASE-1.0-EVIDENCE.md`](../verification/RELEASE-1.0-EVIDENCE.md)

---

This document previously described UV, image, and painting scope for `@modeling-kit/*`.

It enables precise tracking of every capability required to build professional UV editors, texture editors, pixel-art suites, and 3D painting viewports (Blender-level depth combined with Blockbench-style workflow approachability) without recreating complex computational geometry, rasterization, or synchronization systems.

---

## 1. System Architecture & Boundaries

- [x] **Headless Modeling Core**: Packages `@modeling-kit/core`, `mesh`, `materials`, `uv`, `paint`, `document`, `commands`, and `history` execute 100% in Node.js, WebWorkers, and headless runtime environments with zero DOM, Canvas, Three.js, or WebGL dependencies.
- [x] **Clean-Room Engineering**: Completely free of GPL-3.0 / Blockbench code, zero Minecraft formats (`.bbmodel`, OptiFine, MoLang, Bedrock, skin presets).
- [x] **Strict Inversion of Control**: Core SDK never renders DOM elements, menus, toolbars, keybinding tables, or framework components (React, Vue, Svelte, Dockview). Host applications supply their own UI and drive SDK state machines.
- [x] **Adapter Isolation**: Browser APIs (Canvas 2D, WebGL, DOM events, pointer capture) and Three.js objects (`THREE.MeshStandardMaterial`, `THREE.CanvasTexture`) live strictly in `@modeling-kit/three-adapter`, `@modeling-kit/input`, or UI adapters.
- [x] **Deterministic ID & Revision Model**: All entities are uniquely identified with branded types (`MaterialId`, `MaterialSlotId`, `UVChannelId`, `UVVertexId`, `UVEdgeId`, `UVFaceId`, `UVIslandId`, `ImageDocumentId`, `ImageLayerId`, `StrokeId`) with monotonic revision tracking for granular cache invalidation.

---

## 2. Materials & Material Slots System (`@modeling-kit/materials`, `@modeling-kit/mesh`)

### 2.1 Canonical Material Data Model
- [x] **Canonical PBR Material Definition**: `PbrMaterialData` with standard properties (`baseColorFactor`, `roughnessFactor`, `metallicFactor`, `emissiveFactor`, `alphaMode`, `alphaCutoff`, `doubleSided`).
- [x] **Unlit Material Definition**: `UnlitMaterialData` with emissive/tint factors and optional vertex color blending.
- [x] **Texture Slot References**: Typed map channels (`baseColor`, `metallicRoughness`, `normal`, `occlusion`, `emissive`) with transform options (`offset`, `scale`, `rotation`, `texCoordChannel`).
- [x] **Material Slot Model**: Stable `MaterialSlotId`s with name, index, and optional linked `MaterialId`.
- [x] **Per-Face Slot Assignment**: `FaceRecord.materialSlotId` and backward-compatible integer `FaceRecord.materialSlot`.
- [x] **Material Library**: `MaterialLibrary` collection managing materials, slots, assignment lookups, and slot reordering.

### 2.2 Material Validation & Commands
- [x] **Material Validator**: Strict validation of color ranges `[0, 1]`, roughness/metallic `[0, 1]`, texture transforms, and slot consistency.
- [x] **`CreateMaterialCommand`**: Creation and registration of PBR/Unlit materials with full undo/redo.
- [x] **`UpdateMaterialCommand`**: In-place property and texture map mutation with undo/redo snapshotting.
- [x] **`AddMaterialSlotCommand` / `RemoveMaterialSlotCommand`**: Dynamic material slot lifecycle management.
- [x] **`ReorderMaterialSlotsCommand`**: Slot reordering with automatic face reference updates.
- [x] **`AssignMaterialSlotCommand`**: Face selection material slot assignment with previous assignment undo restoration.
- [x] **Document Round-Trip Serialization**: Schema v2 serialization storing `materials` and `materialSlots` in `ModelDocument`.

---

## 3. UV Data Model & Topology Representation (`@modeling-kit/uv`, `@modeling-kit/mesh`)

### 3.1 Mesh Kernel Storage
- [x] **Per-Corner UV Storage**: `CornerRecord.uv` primary channel coordinate `[u, v]`.
- [x] **Multi-Channel Per-Corner UVs**: `CornerRecord.uvChannels` supporting `Record<string, [u, v]>`.
- [x] **Per-Corner Pinning**: `CornerRecord.pinnedUvChannels` tracking pinned status per channel.
- [x] **Channel-Aware Seam Storage**: `EdgeRecord.seamChannels` alongside default boolean `EdgeRecord.isSeam`.
- [x] **Corner Pinning Utilities**: `setCornerPinned`, `isCornerPinned`, and `describeCornerLoop`.
- [x] **Channel Management**: `createDefaultUvChannel`, `createUvChannel`, and default channel identifier `DEFAULT_UV_CHANNEL`.

### 3.2 Derived UV Topology Graph (`UVTopology`)
- [x] **`UVVertex`**: Welded UV coordinate node (`id`, `u`, `v`, `cornerIds`, `spatialVertexId`, `pinned`).
- [x] **`UVEdge`**: Topological UV segment connecting two `UVVertex` entities (`meshEdgeId`, `seam`, `boundary`).
- [x] **`UVFace`**: Directed polygonal UV face referencing ordered `UVVertexId`s, `UVEdgeId`s, `islandId`, and `materialSlot`.
- [x] **`UVIsland`**: Connected component of UV faces bounded by seams or UV chart boundaries, with precomputed UV bounding box (`minU`, `minV`, `maxU`, `maxV`).
- [x] **`UVTopology` Graph Container**: Full bidirectional mapping (`cornerToUVVertex`, `faceToUVFace`, `vertices`, `edges`, `faces`, `islands`).
- [x] **Topology Caching & Invalidation**: `UvTopologyCache` invalidating topology graphs on source mesh, seam, or UV coordinate revision changes.
- [x] **Position-Only Topology Refresh**: `refreshUvTopologyPositions` updating coordinate values and bounding boxes without rebuilding topological adjacency graphs.

---

## 4. Seam Networks & Chart Operations (`@modeling-kit/uv`)

- [x] **Seam Queries**: `edgeHasSeam` inspecting per-channel or default seam flags.
- [x] **Seam Mutation Operations**:
  - [x] `setEdgeSeam`: Mark/unmark seams per edge and channel.
  - [x] `toggleSeams`: Invert seam status across an edge selection.
  - [x] `clearAllSeams`: Clear seam tags from an entire mesh or channel.
  - [x] `markBoundarySeams`: Automatically tag open/boundary mesh edges as seams.
- [x] **Island Segmentation**: Connected component traversal via Union-Find respecting seams and UV boundary splits (`findUvIslands`, `extractUvIslands`).
- [x] **Seam Commands**: Undoable commands wrapping seam state changes with mesh revision increments.

---

## 5. UV Selection Engine (`@modeling-kit/uv`)

- [x] **4 Selection Domains**:
  - [x] `vertex`: Select individual welded UV vertices.
  - [x] `edge`: Select topological UV edges.
  - [x] `face`: Select UV polygon faces.
  - [x] `island`: Select entire connected UV charts.
- [x] **Selection Operations**:
  - [x] `replace`: Overwrite current selection.
  - [x] `add`: Union with current selection.
  - [x] `remove`: Difference from current selection.
  - [x] `toggle`: XOR flip selected elements.
- [x] **Domain Conversion**:
  - [x] Vertices -> incident UV edges / faces / islands.
  - [x] Edges -> endpoint UV vertices / adjacent faces / islands.
  - [x] Faces -> corner vertices / perimeter edges / islands.
  - [x] Islands -> member faces / edges / vertices.
- [x] **Bidirectional 3D <-> 2D Selection Synchronization**:
  - [x] Selecting 3D viewport faces automatically updates 2D UV face/vertex/island selections.
  - [x] Selecting 2D UV faces/islands dispatches canonical 3D `FaceId` selections to the active modeling session.
  - [x] Loop selection: Topological UV edge loops and ring selections along shared faces.
  - [x] Pinned element protection: Filtering or honoring pinned elements during selection transforms.

---

## 6. UV Projection & Unwrapping Algorithms (`@modeling-kit/uv`)

### 6.1 Standard Geometric Projections
- [x] **Planar Projection**:
  - [x] Normal-aligned projection along major axes (`X`, `Y`, `Z`, or arbitrary camera direction).
  - [x] Bounding box fitting and aspect-ratio preservation.
- [x] **Box / Cubic Projection**:
  - [x] 6-way axis projection based on dominant face normals.
  - [x] Per-face texture coordinate alignment and scale matching.
- [x] **Cylindrical Projection**:
  - [x] Longitudinal angle theta = atan2(z, x) mapping to U with seam handling across meridian.
  - [x] Vertical height mapping to V.
- [x] **Spherical Projection**:
  - [x] Azimuth and elevation mapping with polar singularity distortion mitigation.

### 6.2 Advanced Unwrapping & Packing
- [x] **Per-Face Smart Projection**: Automatic angle-based clustering for rapid hard-surface charting.
- [x] **UV Island Packing (`packUvs`)**:
  - [x] 2D bin packing of bounding boxes with configurable margin / padding in texels.
  - [x] Rotation options (0°, 90°, or free orientation for optimal packing efficiency).
  - [x] Aspect-ratio normalization fitting within `[0, 1] x [0, 1]`.
- [ ] **Conformal / LSCM Seam-Based Unwrap**:
  - [ ] Least Squares Conformal Mapping (LSCM) solving discrete Cauchy-Riemann equations across seam cuts.
  - [ ] Pinned vertex constraint enforcement.
  - [ ] Angle-based flattening (ABF++) or conformal relaxation minimizing area and angular distortion.
- [ ] **UV Relax / Smooth Operator**:
  - [ ] Laplacian / spring relaxation of unpinned UV vertices.
  - [ ] Boundary-constrained smoothing preventing island overlap.

---

## 7. UV Coordinate Editing & Manipulation Operators (`@modeling-kit/uv`)

### 7.1 Interactive Transform Sessions
- [x] **`UvTransformSession`**:
  - [x] Transactional lifecycle (`begin`, `update`, `commit`, `cancel`).
  - [x] Transient coordinate previews without polluting command history.
  - [x] Delta applications (`translate`, `rotate`, `scale`, `pivot`).
  - [x] Final execution via `SetCornerUvsCommand` recording a single undoable patch.

### 7.2 Geometric & Pixel Operations
- [x] **Pixel Snapping (`snapUvsToPixels`)**:
  - [x] Quantize UV coordinates to discrete pixel grids based on target texture resolution.
  - [x] Corner snapping, center-pixel snapping, and half-pixel offset modes.
- [x] **UV Welding & Splitting**:
  - [x] `weldUvs`: Merge coincident UV vertices within distance threshold epsilon.
  - [x] `splitUvsAtVertex`: Separate shared UV vertex into independent corners per incident face.
- [ ] **Island Alignment & Distribution**:
  - [ ] Align islands / edges to horizontal / vertical axes.
  - [ ] Distribute islands with uniform spacing.
  - [ ] Flip UVs horizontally / vertically across island or selection centroids.
- [x] **Texel Density Utility**:
  - [x] Calculate world-space surface area to UV space area ratio (`texelDensity`).
  - [ ] Texel density matching: Scale selected islands to match target pixels-per-unit density.

---

## 8. Headless UV View Adapter & Screen Interaction (`@modeling-kit/uv`)

- [x] **View Transform & Coordinate Mapping**:
  - [x] `UVViewTransform` (`zoom`, `panX`, `panY`, `viewportWidth`, `viewportHeight`).
  - [x] Bidirectional conversions: Screen pixels <-> normalized UV coordinates.
- [x] **Spatial Picking Engine (`pickUv`)**:
  - [x] Screen-space proximity picking with configurable pixel hit radius.
  - [x] Mode-sensitive resolution: vertex points, edge segments (point-to-line distance), and face interior point-in-polygon tests.
  - [x] Hover highlight state tracking.
- [x] **Headless Draw Data Model (`UVViewData`)**:
  - [x] Pure data representations of rendering primitives (line segments, vertex circles, textured quads, selection outlines, seam highlights).
  - [x] Theme system (`UVVisualTheme`, `UVEditorPreset`) configuring colors, line widths, and point sizes for professional and stylized editing modes.
- [x] **Dirty Batching & Scheduling (`UVDirtyBatcher`, `UVViewAdapter`)**:
  - [x] Bitmask dirty flags (`UVTopology`, `UVPositions`, `UVSelection`, `UVVisuals`, `Picking`).
  - [x] Coalesced update queueing with custom scheduler hooks (e.g. `requestAnimationFrame` or microtask batching).

---

## 9. Tiled Multi-Layer Image Document System (`@modeling-kit/paint`, `@modeling-kit/document`)

### 9.1 In-Memory Texture Buffer & Pixel Utilities
- [x] **`TextureBuffer`**:
  - [x] RGBA typed array container (`Uint8ClampedArray`).
  - [x] Pixel reading and writing (`getPixel`, `setPixel`).
  - [x] Alpha blending (Porter-Duff source-over blending with alpha factoring).
  - [x] Queue-based flood fill with color tolerance matching.
  - [x] Image buffer cloning and sub-region clearing.

### 9.2 Tiled & Layered Image Document Architecture
- [ ] **Sparse 64x64 Tile Grid (`TiledImageBuffer`)**:
  - [ ] Allocate memory only for non-empty 64x64 pixel tiles.
  - [ ] Support massive canvas dimensions (up to 16384x16384) with low memory footprint.
  - [ ] Tile eviction and LRU caching for inactive canvas regions.
- [ ] **Multi-Layer Hierarchy (`ImageDocument`)**:
  - [ ] Root layer stack with parent-child grouping (`LayerGroup`).
  - [ ] Independent layer properties: `id`, `name`, `opacity` [0, 1], `visible`, `locked`, `blendMode`.
  - [ ] Layer blend modes: `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`.
  - [ ] Clipping masks and layer alpha masks.
- [ ] **Tile Patch Transaction Protocol**:
  - [x] `TextureTilePatch` capturing `tileKey`, `bounds`, `before`, and `after` buffers for modified tiles.
  - [ ] Sparse undo/redo commands storing only mutated 64x64 tiles rather than full-resolution texture snapshots.

---

## 10. Headless 2D/3D Texture Painting Engine (`@modeling-kit/paint`)

### 10.1 Rasterization & Brush Dynamics
- [x] **Brush Modes**: `pencil` (crisp pixel-art alias), `brush` (soft antialiased falloff), and `eraser`.
- [x] **Brush Interpolation**: Continuous line rasterization (`drawBrushLine`) interpolating intermediate dab circles between pointer samples to eliminate stroke gaps during fast gestures.
- [x] **Brush Dab Rasterizer**: Circular distance-falloff stamp with configurable hardness, size, opacity, and color.
- [ ] **Color Dynamics & Jitter**: Pressure-sensitive size, opacity, and jitter controls.
- [ ] **Pixel-Art Tools**:
  - [ ] Perfect pixel pencil: Elimination of double-corner pixels on L-shaped turns.
  - [ ] Dithering brush patterns (Bayer 2x2, 4x4, checkerboard).
  - [ ] Color picker (eyedropper) sampling composited layer stack.

### 10.2 Paint Stroke Session Lifecycle
- [x] **`PaintEngine`**:
  - [x] State machine (`idle` -> `beginning` -> `active` -> `committing` -> `completed` / `cancelled` / `failed`).
  - [x] Bounding box tracking of mutated pixels (`dirtyRect`).
  - [x] Tile patch generation for undo history integration (`collectTilePatches`).
  - [x] Stroke cancellation restoring unmodified initial buffer state.

### 10.3 3D Surface-to-Texture Painting
- [x] **Barycentric UV Interpolation (`interpolateFaceUv`)**: Computes exact (u, v) coordinates from raycast barycentric hit points on polygonal faces.
- [x] **UV-to-Pixel Mapping (`uvToPixel`)**: Converts UV coordinates to target texture pixel coordinates with wrap mode support (`clamp`, `repeat`).
- [x] **Direct 3D Surface Paint (`paintSurfaceHit`)**: Dispatches brush dabs directly to the texture buffer corresponding to the hit face's material slot.
- [x] **Hit Material Resolution (`resolveHitMaterialSlot`)**: Resolves active `MaterialSlotId` from raycast `FaceId`.
- [ ] **Seam-Aware Bleed / Margin Dilation**:
  - [ ] Automatic dilation of painted pixels across UV island boundaries into chart margins (padding gutters) to eliminate black filtering artifacts at mipmap boundaries and seams.
- [ ] **Cross-Island Continuous 3D Painting**:
  - [ ] 3D sphere-brush projection: Projecting brush stamp in world space onto adjacent faces across UV seams and discrete islands.

---

## 11. Viewport & Texture Synchronization Adapters (`@modeling-kit/three-adapter`)

- [x] **Incremental Geometry & Material Sync**: Listens to session events (`material:assigned`, `material:updated`, `mesh:changed`).
- [x] **Material Slot Primitive Splitting**: Triangulates and groups geometry primitives matching document material slots.
- [x] **Texture Sync Adapter**:
  - [x] Dynamically creates and updates `THREE.CanvasTexture` or raw data textures.
  - [x] Sub-region texture updates (`needsUpdate = true` on dirty rects).
- [ ] **Interactive Canvas 2D UV Viewport Component**:
  - [ ] Turnkey Canvas 2D rendering loop consuming `UVViewData` draw lists.
  - [ ] Pan, zoom, and box selection gestures.
- [ ] **Dual-Viewport Synchronization Bridge**:
  - [ ] Painting on 2D texture immediately flushes dirty tiles to 3D Three.js viewport texture.
  - [ ] Painting on 3D mesh surface immediately reflects on 2D UV canvas texture.

---

## 12. Verification & Quality Gates

- [x] **Unit & Integration Tests**: 100% test pass rate across test suite (Vitest: 45 test files, 244 tests passing).
- [x] **Strict TypeScript Typecheck**: 100% clean `tsc --noEmit` across all 28 workspace projects (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, zero `any`).
- [ ] **Performance Benchmarks**:
  - [ ] High-density UV unwrap benchmarks (10,000+ faces under 200ms).
  - [ ] Tiled paint rasterization benchmark (60 FPS stroke throughput at 4096x4096).
  - [ ] Memory footprint verification during high-frequency undo/redo stroke cycles.
