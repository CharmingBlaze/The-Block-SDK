# modeling-kit (`The Block SDK`)

A framework-agnostic TypeScript SDK for polygonal 3D modeling on web and desktop.

The modeling engine is **headless**: it runs in Node.js with no DOM or WebGL. Hosts own UI, cameras, and widgets. An optional [Three.js adapter](packages/three-adapter) derives a viewport, CPU picking, and overlays from the canonical document. There is **no** Minecraft, Blockbench, or other game-format pipeline.

Persistent edits go through commands. Topology lives on the mesh kernel. `THREE.BufferGeometry` is derived only.

---

## Quick start

```bash
pnpm install
pnpm run build
pnpm test
```

### Fluent modeling (recommended)

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();

const stool = editor.spawn
  .cylinder({ radius: 1.2, height: 0.2, name: "Stool" })
  .select("bottom")
  .extrude(0.1)
  .inset(0.15);

console.log(editor.inspect().summary);
// e.g. "Objects: 1 | Faces: 50 | Vertices: 48 | Selected: 1 face | Manifold: true | Undo: true"

editor.selection.move({ y: 0.5 });
editor.undo();
editor.redo();
editor.dispose();
```

Face tags: `top`, `bottom`, `front`, `back`, `sides`, `caps`, `all`. On boxes, `left` is `-X` and `right` is `+X`. `spawn.sphere()` creates a `uvSphere`. Inset uses `distance`. Torus uses `tube`. `createEditor()` owns its session; call `editor.dispose()` when finished. If you pass an existing `ModelingSession`, you still own that session.

### Three.js viewport

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
viewport.dispose();
editor.dispose();
```

`createThreeViewport` creates the renderer, perspective camera, hemisphere + 3-point studio lights, ground grid, damped OrbitControls, resize handling, and adapter sync. Left-click raycasts through `adapter.pick` into session selection (`onSelect` is optional). Right-drag orbits; middle-drag dollies. Hosts that already use `@modeling-kit/input` should pass `picking: false` and call `adapter.pick` from `select.pick`.

### AI / agent tools

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
editor.dispose();
```

Tools: `spawn_primitive`, `select_components`, `extrude_faces`, `inset_faces`, `bevel_edges`, `subdivide_faces`, `catmull_clark`, `loop_cut`, `dissolve_edges`, `fill_boundary`, `knife_stroke`, `heal_mesh`, `weld_vertices`, `triangulate_faces`, `merge_vertices`, `connect_vertices`, `transform_selection`, `undo`, `redo`, `inspect_scene`, `save_scene` (native JSON in `data.json`).

### Background compute

```ts
import { createInlineComputePool } from "@modeling-kit/sdk";
// Browser: import { createBrowserComputePool } from "@modeling-kit/workers/browser";
// Node:    import { createNodeComputePool } from "@modeling-kit/workers/node";

const pool = createInlineComputePool();
try {
  const tri = await pool.triangulateAsync(serializedMesh);
} finally {
  pool.dispose();
}
```

Pools are host-owned. There is no process-wide shared pool. Jobs: triangulate, pack UVs, validate.

---

## Systems in place

These are the subsystems a host or agent uses to build a modeling application. They share one document, one mesh kernel, and command history.

### Foundation

| System | Package | What it does |
| --- | --- | --- |
| Core | `@modeling-kit/core` | Branded IDs (`DocumentId`, `ObjectId`, `MeshId`, `FaceId`, …), `Result`/errors, events, diagnostics, `OperationLifecycleMachine` / `ResourceLifecycleMachine` |
| Math | `@modeling-kit/math` | Vectors, matrices, quaternions, rays, bounds, robust orientation predicates. No Three.js |

### Canonical model

| System | Package | What it does |
| --- | --- | --- |
| Document | `@modeling-kit/document` | Versioned `ModelDocument`, native JSON, schema migrations, revision counters, transactions |
| Scene | `@modeling-kit/scene` | Hierarchy, reparent, group/ungroup, visibility/lock, world-transform cache, cycle rejection |
| Mesh kernel | `@modeling-kit/mesh` | Half-edge mesh (triangles, quads, n-gons), adjacency, triangulation with `FaceId` traceability |
| Validation | `@modeling-kit/validation` | Manifold, degeneracy, winding, heal |

`ModelDocument` is what you save. `ModelingSession` holds selection, history, live meshes, transform/paint gestures, and animation time. Previews do not write history; commit or cancel is explicit.

### Modeling

| System | Package | What it does |
| --- | --- | --- |
| Primitives | `@modeling-kit/primitives` | Box/cube, plane, grid, disc, cylinder, cone, pyramid, UV sphere, icosphere, torus, capsule, ramp, stairs, arch, wall, column |
| Operators | `@modeling-kit/mesh` | Extrude, inset, bevel, subdivide, Catmull–Clark, loop cut, dissolve, collapse, fill, knife, weld/merge, connect, split/cut, bridge, duplicate/join, triangles-to-quads, reverse winding |
| Commands | `@modeling-kit/commands` | Every persistent edit is a command; `ModelingSession.execute` |
| History | `@modeling-kit/history` | Undo/redo, merge, drag coalescing, transactions, exact topology snapshots |
| Fluent editor | `@modeling-kit/commands` via `@modeling-kit/sdk` | `createEditor()` for scripts and agents |
| Interactive tools | `@modeling-kit/tools` | Modal sessions (knife, loop cut, extrude, bevel, merge): preview, then one command on commit |

### Editor session

| System | Package | What it does |
| --- | --- | --- |
| Selection | `@modeling-kit/selection` | Object/face/edge/vertex; grow/shrink/linked/loop/ring/boundary/coplanar; box/lasso |
| Transform | `@modeling-kit/transform` | Translate/rotate/scale; world/local/parent/view/normal; median/bounds/active pivots; gesture lifecycle |
| Snapping | `@modeling-kit/snapping` | Grid, vertex, edge, midpoint, face, face-surface; priority and hysteresis |
| Input | `@modeling-kit/input` | Headless actions and keymaps. Optional `@modeling-kit/input/dom` |
| Capabilities | `@modeling-kit/commands` | `session.capabilities.canExecute` for UI and agents |

### Assets

| System | Package | What it does |
| --- | --- | --- |
| Materials | `@modeling-kit/materials` | PBR and unlit, slots, texture bindings |
| UV | `@modeling-kit/uv` | Planar/box/cylindrical/spherical, seams, islands, shelf pack, UV editor session |
| Images + paint | `@modeling-kit/paint` | Tiled RGBA, layers, dabs/lines/eraser, flood fill, UV-to-pixel 3D paint |
| Textures | `@modeling-kit/document` + commands | Create, bind, undoable texture sets |

### Viewport

| System | Package | What it does |
| --- | --- | --- |
| Three.js adapter | `@modeling-kit/three-adapter` | Derived GPU view; incremental sync; CPU `Raycaster` pick to branded IDs; selection/hover/knife overlays; `createThreeViewport()` |
| Spatial query | `@modeling-kit/three-adapter` | Brute-force backend (no BVH yet) |

The adapter never owns the editable mesh. Dispose the viewport, then the editor/session.

### I/O and compute

| System | Package | What it does |
| --- | --- | --- |
| Native JSON | `@modeling-kit/document` | Canonical persistence (`session.saveNativeJson()` / `ModelingSession.loadNativeJson`) |
| Open formats | `@modeling-kit/formats` | glTF/GLB (triangulated geometry, hierarchy, PBR factors); OBJ; ASCII STL; PPM images |
| Workers | `@modeling-kit/workers` | Host-owned pools: inline, `/browser` (`Worker`), `/node` (`worker_threads`) |

### Facades

| System | Import | What it does |
| --- | --- | --- |
| Headless SDK | `@modeling-kit/sdk` | Re-exports modeling subsystems |
| Viewport SDK | `@modeling-kit/sdk/three` or `@modeling-kit/three-adapter` | Optional Three.js |
| AI tools | `@modeling-kit/sdk/ai` | OpenAI-style function schemas + `executeEditorTool` |

### Preview (packages exist, not 1.0 product)

| System | Package | Status |
| --- | --- | --- |
| Rigging | `@modeling-kit/rigging` | Bones, inverse bind, linear blend skinning (`RIG-001`) |
| Animation | `@modeling-kit/animation` | Document clips and sampling (`ANIM-001`) |

### Not in this SDK

Boolean CSG, GPU ID-buffer picking, LSCM/ABF unwrap, paint/IO worker jobs, game/Minecraft/`.bbmodel` formats, and a DCC application UI (hosts own cameras, panels, and widgets).

### Host examples

`apps/playground`, `apps/example-react`, `apps/example-vue`, `apps/scratch-host`, `apps/geometry-gallery`.

---

## How the systems fit together

```
Host UI / agent
    →  createEditor() or ModelingSession + commands
    →  ModelDocument (canonical, serializable)
    →  mesh kernel / scene / materials / UV / paint
    →  ThreeViewportAdapter (derived view only)
```

1. Persistent edits go through commands and history.
2. Algorithms run on the mesh kernel, never on `THREE.BufferGeometry`.
3. Selection uses branded IDs, never render-buffer indices.
4. Transform, UV, paint, and modal tools use `OperationLifecycleMachine` (begin → active → commit or cancel).
5. Hosts construct workers, viewports, and editors; they call `dispose()` on unmount. No required globals.

---

## Documentation

| Doc | Contents |
| --- | --- |
| [Getting started](docs/guides/getting-started.md) | Session + commands + adapter, dispose, workers |
| [UV editor](docs/guides/uv-editor.md) | Headless UV session, projections, lifecycle machines |
| [Paint and images](docs/guides/paint-image.md) | Tiles, layers, strokes, 3D paint |
| [Materials](docs/guides/materials.md) | PBR/unlit, slots, texture sets |
| [Geometry predicates](docs/guides/geometry-predicates.md) | Robust `orient2d`/`orient3d` vs `GeometryTolerance` |
| [SDK architecture](docs/architecture/sdk-architecture.md) | Package graph, workers, ownership |
| [Ownership](docs/architecture/ownership.md) | Who owns document, session, GPU objects |
| [Mesh kernel](docs/architecture/mesh-kernel.md) | Half-edge invariants |
| [Document model](docs/architecture/document-model.md) | Schema and scene |
| [Commands](docs/architecture/command-system.md) | Undo model |
| [Input](docs/architecture/input.md) | Headless keymaps vs DOM |
| [Interactive tools](docs/architecture/interactive-tools.md) | Preview vs commit |
| [Three.js adapter](docs/architecture/three-adapter.md) | Sync and picking |
| [Operator specification](docs/architecture/modeling-operator-specification.md) | 1.0 requirement IDs |
| [Release evidence](docs/verification/RELEASE-1.0-EVIDENCE.md) | Tests and recorded gates |
| [Clean-room rules](docs/research/clean-room-rules.md) | No GPL / no game formats |

---

## Packages

```text
packages/
  ├── core/             # Branded IDs, events, lifecycle machines
  ├── math/             # Vector3, Matrix4, Quaternion, predicates
  ├── mesh/             # Half-edge kernel, operators, triangulation
  ├── document/         # Canonical document, serialization
  ├── scene/            # Hierarchy and DAG cycle rejection
  ├── validation/       # Topological and geometric validator
  ├── selection/        # Object/face/edge/vertex selection
  ├── history/          # Undo/redo and transactions
  ├── transform/        # Pivots, spaces, transform gestures
  ├── snapping/         # Grid and nearest-element snapping
  ├── tools/            # Interactive topology tools
  ├── materials/        # PBR / unlit, slots, bindings
  ├── uv/               # Projections, seams, packing, UV editor
  ├── rigging/          # Preview skeletons and skinning
  ├── animation/        # Preview clips and sampling
  ├── paint/            # RGBA tiles, rasterizer, flood fill
  ├── formats/          # glTF 2.0, OBJ, STL, PPM
  ├── workers/          # Inline / browser / Node compute pools
  ├── commands/         # Commands, ModelingSession, fluent editor
  ├── input/            # Headless input; optional ./dom
  ├── three-adapter/    # Three.js viewport, picking, overlays
  └── sdk/              # Facade; ./three and ./ai optional
```

---

## License & provenance

MIT. Clean-room implementation. No GPL code from Blockbench or similar products.

See `docs/research/clean-room-rules.md` and `docs/research/provenance-log.md`.
