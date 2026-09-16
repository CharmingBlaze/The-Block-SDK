# Modeling-Kit Implementation Roadmap

**Status:** Historical phase narrative only. Non-deferred 1.0 rows are `VERIFIED` in `docs/verification/RELEASE-1.0-EVIDENCE.md`. Still out of 1.0: RIG, ANIM, BOOL, LSCM/ABF. GPU-PICK-001 **click** picking is in 1.0; GPU hover / InstancedMesh / GPU skinning are 1.1. See `docs/architecture/modeling-operator-specification.md`.  
**Constraint:** Clean-room implementation. Independent general 3D polygonal modeling foundation. Zero Minecraft or game-specific constraints.

---

## Roadmap Overview

```
Phase 0: Research & Architecture (Complete)
   │
   ▼
Phase 1: Foundation (Monorepo, Document, Scene Graph, Serialization)
   │
   ▼
Phase 2: Mesh Kernel (Topology, Adjacency, Triangulation, Validation)
   │
   ▼
Phase 3: Commands & Selection (History, Transactions, Selection Remap)
   │
   ▼
Phase 4: Three.js Adapter (Sync, Pick, Gizmos, Viewports)
   │
   ▼ ───► [MILESTONE 1: Create Cube -> Extrude Face -> Undo/Redo -> Render]
Phase 5: Modeling Tools (Bevel, Inset, Loop Cut, Knife, Bridge, Subdivide)
   │
   ▼
Phase 6: UV & Materials (Unwrap, Seams, Packing, Material Slots)
   │
   ▼
Phase 7: Rigging & Animation (Bones, Weights, Timeline, Keyframe Clips)
   │
   ▼
Phase 8: Painting & Open Formats (glTF/GLB, OBJ, STL, Native JSON)
   │
   ▼
Phase 9: Hardening & Release (Benchmarks, Workers, React/Vue Demos, 1.0)
```

---

## Phase Breakdown & Acceptance Criteria

### Phase 0: Research & Architecture (COMPLETE)

- [x] Clean-room rules established (`docs/research/clean-room-rules.md`)
- [x] Provenance and license logs created (`docs/research/provenance-log.md`)
- [x] Risk register documented (`docs/research/risk-register.md`)
- [x] Clean-room capability map compiled (`docs/research/blockbench-capability-map.md`)
- [x] SDK high-level architecture specified (`docs/architecture/sdk-architecture.md`)
- [x] Mesh kernel architecture specified (`docs/architecture/mesh-kernel.md`)
- [x] Document model architecture specified (`docs/architecture/document-model.md`)
- [x] Command system architecture specified (`docs/architecture/command-system.md`)
- [x] Three.js adapter architecture specified (`docs/architecture/three-adapter.md`)

---

### Phase 1: Core Foundation (COMPLETE)

- [x] Monorepo setup with pnpm workspaces, TypeScript strict mode, tsup bundler, and Vitest test runner.
- [x] Branded type utilities (`Brand<T, Name>`) and identifier generators for `DocumentId`, `ObjectId`, `MeshId`, etc.
- [x] Math package: `Vector3`, `Matrix4`, `Quaternion`, `Euler`, `BoundingBox`, `Ray`.
- [x] Typed `EntityStore<T>` collections with revision tracking.
- [x] Canonical `ModelDocument` schema definition and JSON serialization/deserialization.
- [x] `SceneGraph` manager supporting add, remove, reparent (with world transform preservation), and cycle rejection.
- [x] Typed `EditorEvents` emitter running headlessly without DOM dependencies.

---

### Phase 2: Mesh Kernel & Validation (COMPLETE)

- [x] Hybrid Face-Edge-Corner / Radial Half-Edge mesh representation.
- [x] Topological adjacency queries (`getVertexEdges`, `getVertexFaces`, `getFaceEdges`, `getAdjacentFaces`, `findBoundaryEdges`, `findConnectedComponents`).
- [x] Mesh builder API (`MeshBuilder`) for procedural mesh construction.
- [x] Triangulation pipeline converting general polygons/n-gons to triangle indices with source `FaceId` traceability.
- [x] Deterministic geometric and topological validator (`validateMesh`).

**Acceptance Criteria:**

- Unit tests pass on standard primitives: Triangle, Quad, N-gon, Cube, and Open mesh topology.
- Triangulation output correctly maps each triangle back to its parent `FaceId`.
- Non-manifold edges, zero-length edges, and degenerate faces are reported.

---

### Phase 3: Commands & Selection (COMPLETE)

**Target Packages:** `@modeling-kit/commands`, `@modeling-kit/history`, `@modeling-kit/selection`, `@modeling-kit/sdk`

- [x] `Command` / `CommandManager` with execute, undo, redo, merge, and transactions.
- [x] Selection manager for object/vertex/edge/face domains with remap/delete transfer.
- [x] `CreatePrimitiveCommand` (cube) and `ExtrudeFacesCommand` with exact mesh snapshots.
- [x] `createModelingSession` convenience API and native JSON save/load of mesh kernels.

**Acceptance Criteria:**

- [x] Create cube → select face → extrude → undo → redo restores topology fingerprints.
- [x] Transactions rollback without leaving history entries.
- [x] Command merging coalesces sequential compatible commands.

**Deliverables:**

1. `Command` and `Transaction` interfaces with `execute()`, `undo()`, and `redo()`.
2. `CommandManager` maintaining undo/redo history, dirty flag, and history limits.

- [x] Pointer drag coalescing (continuous transient previews committed as a single command on release).
- [x] `beginTransform` / `updateTransform` / `commitTransform` / `cancelTransform` on `ModelingSession` (`@modeling-kit/transform`, `@modeling-kit/snapping`).

4. Selection manager supporting Object, Vertex, Edge, and Face domains.
5. Topology selection transfer / remapping protocol across destructive mesh operations.

**Acceptance Criteria:**

- Every command sequence can be completely undone and redone without residual state or numerical drift.
- Selections survive topology alterations via returned remapping tables.
- Drag cancellation cleanly restores initial state with 0 history entries.

---

### Phase 4: Three.js Viewport Adapter (COMPLETE)

**Target Packages:** `@modeling-kit/three-adapter`, `@modeling-kit/sdk`

- [x] `ThreeViewportAdapter` maps session meshes to `THREE.Mesh` with triangulation + `FaceId` maps.
- [x] Incremental sync from document/mesh events; multiple adapters per session.
- [x] Raycast picking to object/face/edge/vertex using canonical IDs.
- [x] Face selection overlay (selected faces only), plus edge lines, vertex points, and object wireframe.
- [x] Outliner commands: `ReparentCommand`, `DuplicateObjectsCommand` (clones mesh kernels), `SetVisibilityCommand`, `GroupObjectsCommand`, `UngroupObjectsCommand`.
- [x] Selection changes emit `selection:changed` so viewport overlays update without a manual `sync()`.
- [x] Paint stroke session (`beginPaintStroke` / `commitPaintStroke` / `cancelPaintStroke`) records one history command per stroke.
- [x] `dispose()` unsubscribes, disposes adapter geometries/materials, leaves the host scene.

**Acceptance Criteria:**

- [x] Four viewports can mount one session.
- [x] Center-ray pick of a unit cube from +Z resolves `faceIds.posZ`.
- [x] Disposed adapters throw on `sync()` and detach from the host scene.

TransformControls are not built in; hosts may attach gizmos to the adapter root. Hosts should drive `session.beginTransform` / `updateTransform` / `commitTransform` / `cancelTransform`.

**Deliverables:**

1. `ThreeViewportAdapter` bridging `EditorSession` to a `THREE.Scene`.
2. Incremental geometry and transform synchronization listening to document events.
3. CPU `THREE.Raycaster` picking resolving clicked pixels back to canonical `ObjectId`, `FaceId`, `EdgeId`, or `VertexId` (not a GPU ID-buffer pass).
4. Selection overlays (face subset, edge lines, vertex points, object wire) and transform gizmo integration (host TransformControls + session transform protocol).
5. Clean resource disposal (`adapter.dispose()`).

**Acceptance Criteria:**

- A single document/session can be mounted concurrently across 4 distinct Three.js viewports.
- Raycasting accurately identifies canonical `FaceId`s from rendered 3D clicks.
- `adapter.dispose()` leaves zero memory leaks or dangling GPU buffers.

---

### Vertical Milestone 1 Gate

The following integration snippet runs successfully end-to-end:

```ts
import * as THREE from "three";
import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
} from "@modeling-kit/sdk";
import { ThreeViewportAdapter } from "@modeling-kit/three-adapter";

const session = createModelingSession();
const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
session.selection.replace({
  domain: "face",
  objectId: cube.objectId,
  elementIds: [cube.faceIds.top],
});
session.execute(new ExtrudeFacesCommand({ distance: 1 }));
session.history.undo();
session.history.redo();
const json = session.saveNativeJson();
const reloaded = ModelingSession.loadNativeJson(json);
```

---

### Phase 5: Advanced Modeling Tools (COMPLETE)

**Target Packages:** `@modeling-kit/tools`, `@modeling-kit/commands`, `@modeling-kit/sdk`

- [x] Inset faces (`insetFaces`, `InsetFacesCommand`)
- [x] Face subdivision (`subdivideFaces`, `SubdivideFacesCommand`)
- [x] Vertex welding / collapse (`weldVertices`)
- [x] Boundary loop bridge (`bridgeLoops`)
- [x] Edge bevel / chamfer (`bevelEdges`, `BevelEdgesCommand`)
- [x] Quad loop cut (`loopCut`, `LoopCutCommand`)
- [x] Edge dissolve (`dissolveEdges`, `DissolveEdgesCommand`)
- [x] Batch knife operators (`splitEdge`, `cutFace`, `SplitEdgeCommand`, `CutFaceCommand`) — headless topology only
- [x] Interactive knife cursor / viewport gesture (`KnifeTool` snapping + playground `setKnifePreview`; hosts may still drive `cutFace` from picks)

### Phase 6: UV & Materials (COMPLETE)

**Target Packages:** `@modeling-kit/materials`, `@modeling-kit/uv`

- [x] Document PBR `MaterialData` / `TextureData` (no `THREE.Material` in the document)
- [x] Material slots on faces + mesh `materialIds`
- [x] UV projections: planar, box, cylindrical, spherical, per-face smart
- [x] Seams, island detection, shelf packing, UV transforms, weld/split, pixel snap
- [x] Commands: project UV, pack UV, set seams, create/assign material
- [x] Three.js `MeshStandardMaterial` sync from document materials
- [ ] Conformal LSCM unwrap (deferred; projections + pack cover the batch path)

### Phase 7: Rigging & Animation (COMPLETE)

**Target Packages:** `@modeling-kit/rigging`, `@modeling-kit/animation`, `@modeling-kit/commands`, `@modeling-kit/sdk`

- [x] Skeleton / bone hierarchy, rest pose, inverse bind, cycle-safe reparent
- [x] Rigid and nearest-bone weights, normalize, validate, linear-blend skinning
- [x] Animation clips, tracks, constant/linear/cubic interpolation, playback, reverse/scale time
- [x] Commands: create skeleton, bind skin, create clip, set keyframe (undoable)
- [x] CPU pose preview and linear blend skinning evaluation

### Phase 8: Painting & Open Formats (COMPLETE)

**Target Packages:** `@modeling-kit/paint`, `@modeling-kit/formats`, `@modeling-kit/sdk`

- [x] In-memory RGBA `TextureBuffer` manipulation (blit, sample, clear, get/set pixel)
- [x] 2D rasterizer for brush dabs and interpolated line strokes
- [x] Queue-based flood fill with color tolerance matching
- [x] UV-to-pixel coordinate projection mapper with wrap modes (clamp, repeat)
- [x] Wavefront OBJ export and import parser with polygon vertex/UV indices
- [x] Stereolithography (STL) ASCII export with facet normal generation
- [x] glTF 2.0 JSON **export** from the scene graph (node TRS, children, mesh instances, TEXCOORD_0, PBR metallic-roughness factors, primitives split by material slot)
- [x] glTF 2.0 **GLB** export/import (header + JSON chunk + BIN chunk; buffer 0 has no URI)
- [x] glTF 2.0 JSON **import** (embedded buffers, scene TRS, welded kernel vertices, triangle faces, PBR materials). External buffer URIs, sparse accessors, skins, and textures are out of this importer.
- [x] Native JSON persists texture RGBA payloads (`pixelsBase64`) via session flush/hydrate.

### Phase 9: Hardening & Release (COMPLETE)

**Target Packages:** `@modeling-kit/workers`, `@modeling-kit/sdk`, `apps/playground`, `apps/example-react`, `apps/example-vue`

- [x] Asynchronous compute pool (`AsyncComputePool`, `createInlineComputePool` / `createBrowserComputePool` / `createNodeComputePool`) for offloading heavy geometry tasks (`triangulateAsync`, `packUvsAsync`, `validateAsync`). Hosts own the pool and `dispose()` it.
- [x] Performance benchmarks verifying high-speed triangulation, document serialization/deserialization.
- [x] Memory leak regression tests verifying command history depth capping across 100+ executed commands without memory bloat.
- [x] End-to-end SDK integration test suite verifying the Milestone 1 pipeline and unified export facade.
- [x] Vite-powered Interactive 3D Playground application (`apps/playground`) demonstrating viewport rendering, procedural primitive creation, face extrusion, undo/redo, and glTF 2.0 export.
- [x] React 18 integration example application (`apps/example-react`) with interactive viewport, state binding, and command execution.
- [x] Vue 3 integration example application (`apps/example-vue`) with reactive stats, ThreeViewportAdapter lifecycle hooks, and extrusion workflow.
- [x] Canonical primitives in `@modeling-kit/primitives` (box, plane, grid, disc, cylinder, cone, pyramid, UV sphere, icosphere, torus, capsule, ramp, stairs, arch, wall, column) with MeshBuilder topology, per-corner UVs, semantic groups, and validation.
- [x] Monorepo strict typecheck (`tsc --noEmit`) passing cleanly with 0 errors across all 21 workspace library packages.
- [x] All 21 packages and 3 applications successfully building for production with ESM and `.d.ts` declaration maps.

