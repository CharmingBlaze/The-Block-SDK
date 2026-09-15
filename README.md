# modeling-kit (`The Block SDK`)

A high-performance, framework-agnostic TypeScript 3D polygonal modeling SDK for web and desktop applications.

Designed as a clean-room, reusable computational geometry foundation with **zero** game-specific or Minecraft constraints. The core modeling engine is fully headless, testable in Node.js with no DOM or WebGL requirements, while providing an optional [Three.js adapter](packages/three-adapter) for real-time viewport synchronization, raycast picking, and overlays.

---

## Features & Capabilities

- **Mesh Kernel (`@modeling-kit/mesh`)**: Half-edge topology data structure supporting triangles, quads, and n-gons with topological adjacency queries and deterministic triangulation with `FaceId` traceability.
- **Transactional Commands & History (`@modeling-kit/commands`, `@modeling-kit/history`)**: Fully undoable and redoable command system with command merging, drag coalescing, transaction rollback, and history limits.
- **Foundational Modeling Tools (`@modeling-kit/tools`)**: Extrude, Inset, Subdivide, Weld, Bridge, Bevel, Loop Cut, and Dissolve.
- **Transforms & Snapping (`@modeling-kit/transform`, `@modeling-kit/snapping`)**: Multi-pivot transforms (median, bounds, active), world/local/normal spaces, and grid/vertex/edge snapping.
- **UV & Materials (`@modeling-kit/uv`, `@modeling-kit/materials`)**: Planar, Box, Cylindrical, and Spherical UV projections, island extraction, shelf packing, seam marking, and PBR material definitions.
- **Rigging & Animation (`@modeling-kit/rigging`, `@modeling-kit/animation`)**: Directed acyclic bone graphs, rest transforms, inverse bind matrices, linear blend skinning (LBS), keyframe tracks, and multi-mode interpolation (Step, Linear, CubicSpline).
- **In-Memory Painting (`@modeling-kit/paint`)**: Pure RGBA pixel buffer rasterization (dabs, lines, eraser), queue-based flood fill, and UV-to-pixel coordinate projection.
- **Open Standards I/O (`@modeling-kit/formats`)**: glTF 2.0 (with embedded base64 buffers), Wavefront OBJ (export and import), and Stereolithography (STL) ASCII export.
- **Asynchronous Workers (`@modeling-kit/workers`)**: `AsyncComputePool` offloading heavy triangulation, UV packing, and topology validation.
- **Three.js Viewport Adapter (`@modeling-kit/three-adapter`)**: Incremental synchronization from document/mesh events, CPU `Raycaster` picking to canonical element IDs (`ObjectId`, `FaceId`, `EdgeId`, `VertexId`), selection overlays, knife guide overlays (`setKnifePreview`), and leak-free resource disposal.
- **Unified SDK Facade (`@modeling-kit/sdk`)**: Headless re-exports of modeling subsystems. Viewport APIs live on `@modeling-kit/three-adapter` or `@modeling-kit/sdk/three`.

---

## Quick Start

```bash
pnpm install
pnpm run build
pnpm test
```

### Fluent Modeling & Inspection (Recommended)

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();

const stool = editor.spawn
  .cylinder({ radius: 1.2, height: 0.2, name: "Stool" })
  .select("bottom")
  .extrude(0.1)
  .inset(0.15);

const inspection = editor.inspect();
console.log(inspection.summary);
// e.g. "Objects: 1 | Faces: 50 | Vertices: 48 | Selected: 1 face | Manifold: true | Undo: true"

editor.selection.move({ y: 0.5 });
editor.undo();
editor.redo();
```

Face tags: `top`, `bottom`, `front`, `back`, `sides`, `caps`, `all`. On boxes, `left` is `-X` and `right` is `+X`. `spawn.sphere()` creates a `uvSphere`. Inset uses `distance`. Torus uses `tube`.

### Turnkey Three.js Viewport

```ts
import { createEditor } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/three-adapter";
// or: import { createThreeViewport } from "@modeling-kit/sdk/three";

const editor = createEditor();
const container = document.getElementById("viewport")!;

const viewport = createThreeViewport({
  container,
  session: editor.session,
  grid: true,
  lighting: "studio",
  camera: { fov: 45, position: [5, 5, 7] },
  orbitControls: true,
  damping: true,
  autoResize: true,
  picking: true,
  pickDomain: "face",
  onSelect: (hit) => {
    if (hit) {
      console.log("Picked", hit.domain, hit.elementId);
    }
  },
});

editor.spawn.cube({ size: 2 });
viewport.setKnifePreview({
  cursor: [0, 1, 0],
  segments: [[[-1, 1, 0], [1, 1, 0]]],
});
```

`createThreeViewport` creates the renderer, perspective camera, hemisphere + 3-point studio lights, ground grid, damped OrbitControls, `ResizeObserver` + window resize, and `ThreeViewportAdapter` sync. Left-click raycasts through `adapter.pick` into session selection (`onSelect` is optional). Right-drag orbits; middle-drag dollies. Hosts that already use `@modeling-kit/input` should pass `picking: false` and call `adapter.pick` from `select.pick`.

### AI / Agent Tool Calling (OpenAI / Anthropic / Gemini)

```ts
import {
  createEditor,
  getEditorToolDefinitions,
  executeEditorTool,
} from "@modeling-kit/sdk/ai";

const editor = createEditor();
const tools = getEditorToolDefinitions();
const result = executeEditorTool(editor, "spawn_primitive", {
  type: "cube",
  width: 2,
  height: 2,
  depth: 2,
});

if (result.ok) {
  console.log(result.inspection.summary);
}
```

---

## Monorepo Packages

```text
packages/
  ├── core/             # Branded IDs, event emitter, errors
  ├── math/             # Vector3, Matrix4, Quaternion, Euler, BoundingBox, Ray
  ├── mesh/             # HalfEdgeMesh kernel, procedural builders, triangulation
  ├── document/         # Canonical document model, entity stores, serialization
  ├── scene/            # SceneGraph hierarchy and DAG cycle rejection
  ├── validation/       # Deterministic topological & geometric validator
  ├── selection/        # Selection manager across object/face/edge/vertex domains
  ├── history/          # Undo/redo command manager and transactions
  ├── transform/        # Coordinate conversions, pivot points, transform gestures
  ├── snapping/         # Grid, increment, angle, and nearest-point snapping
  ├── tools/            # Topology tools (inset, subdivide, bevel, loop cut, etc.)
  ├── materials/        # PBR material models, texture bindings, slots
  ├── uv/               # UV projections, seam marking, island shelf packing
  ├── rigging/          # Skeletons, inverse bind matrices, linear blend skinning
  ├── animation/        # Animation clips, keyframe tracks, sampler/interpolator
  ├── paint/            # RGBA texture buffers, brush rasterizer, flood fill
  ├── formats/          # Open format exporters/importers (glTF 2.0, OBJ, STL)
  ├── workers/          # Asynchronous background compute pool
  ├── commands/         # Transactional commands & ModelingSession
  ├── three-adapter/    # Three.js viewport synchronization & picking
  └── sdk/              # Unified entry point re-exporting all packages
```

---

## License & Provenance

Strictly clean-room implementation. Zero GPL code adapted or copied from reference products.
See `docs/research/clean-room-rules.md` and `docs/research/provenance-log.md`.

Release 1.0 requirements and evidence: `docs/architecture/modeling-operator-specification.md`, `docs/verification/RELEASE-1.0-EVIDENCE.md`.
