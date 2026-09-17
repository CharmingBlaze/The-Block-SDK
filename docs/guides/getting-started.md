# Getting started

**The Block SDK** is a headless TypeScript SDK. npm installs are `@modeling-kit/*` (start with `@modeling-kit/sdk`). The private git workspace is named `modeling-kit`. Hosts own cameras, renderers, and UI. The systems list lives in the [root README](../../README.md). The full documentation index is [`../README.md`](../README.md).

Public packages are MIT-licensed, currently `0.1.0`. There is no Minecraft, `.bbmodel`, or game-format support. Native JSON is the canonical persistence format.

**Runtime:** Node.js 22+, pnpm 11. Node 22 is the CI-proven floor (`setup-node` in `.github/workflows/ci.yml` and `.github/workflows/release.yml`). A Node 20 job is not in CI: this repo's `packageManager` is pnpm@11.7.0 (Node >=22.13), and `@changesets/cli` / `dependency-cruiser` also require Node 22. Browser bundles still target ES2022; `engines.node` is `>=22` so package managers do not install the SDK on an untested Node 20 toolchain.

From source:

```bash
pnpm install
pnpm run build
pnpm test
```

After a git tag such as `v0.1.0` has been published:

```bash
pnpm add @modeling-kit/sdk
```

See [Publishing](publishing.md) for the tag workflow. Three.js viewports also need `three` and `@modeling-kit/three-adapter`.

## Fluent editor (recommended)

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();
editor.spawn
  .cylinder({ radius: 1.2, height: 0.2, name: "Stool" })
  .select("bottom")
  .extrude(0.1)
  .inset(0.15);

console.log(editor.inspect().summary);
const json = editor.session.saveNativeJson();
editor.dispose();
```

`createEditor()` owns its `ModelingSession`. Call `editor.dispose()` when the host unmounts. If you pass an existing session into `createEditor(session)`, you still own that session.

Face tags: `top`, `bottom`, `front`, `back`, `sides`, `caps`, `all`. On boxes, `left` is `-X` and `right` is `+X`. `spawn.sphere()` creates a `uvSphere`. Inset uses `distance`. Torus uses `tube`. Full API: [Fluent editor](fluent-editor.md).

## Commands and session

```ts
import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
} from "@modeling-kit/sdk";

const session = createModelingSession(createSequenceIdFactory("demo"));
const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
session.selection.replace({
  domain: "face",
  objectId: cube.objectId,
  elementIds: [cube.faceIds.top],
});
session.execute(new ExtrudeFacesCommand({ distance: 1 }));
session.undo();
session.redo();
const json = session.saveNativeJson();
session.dispose();
```

Every persistent edit is a command. Pointer drags preview without history; one command commits on release. See [Selection, transform, snapping](selection-transform.md).

## Viewport (host-owned Three.js)

```ts
import { createEditor } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/three-adapter";
// or: import { createThreeViewport } from "@modeling-kit/sdk/three";

const editor = createEditor();
const viewport = createThreeViewport({
  container: document.getElementById("viewport")!,
  session: editor.session,
  lighting: "studio",
  orbitControls: true,
  damping: true,
  picking: true,
  pickDomain: "face",
});
editor.spawn.cube({ size: 2 });
viewport.dispose();
editor.dispose();
```

Completed left-clicks use GPU ID-buffer picking (`adapter.pickPoint`) with a CPU `Raycaster` fallback. Hover stays on `adapter.pick`. Left click selects; right-drag orbits; middle-drag pans; wheel dollies. Hosts that bind `@modeling-kit/input` should pass `picking: false`. Details: [Viewport](viewport.md), [custom host picking](custom-host-picking.md).

## Workers

Heavy triangulation, UV packing, UV unwrap, and mesh validation can run on `@modeling-kit/workers`. Construct a pool and dispose it with the editor. Do not run `triangulateMesh` on pointer-move; 10k–100k vertex rebuilds are batch-scale in 0.1 (see [Triangulation](triangulation.md)).

- `@modeling-kit/sdk` / `@modeling-kit/workers` — inline (scripts and headless TypeScript)
- `@modeling-kit/workers/browser` — `createBrowserComputePool()`
- `@modeling-kit/workers/node` — `createNodeComputePool()`

See [Workers](workers.md).

## Libraries vs formats

Everything editable lives in `HalfEdgeMesh` / native JSON. Other packages only ingest or dump:

| Need | Call | Do not |
| --- | --- | --- |
| Canonical cube / UV sphere | `editor.spawn.cube()` / `spawn.sphere()` | Treat `primitive-geometry`’s cube as the same mesh |
| Library recipe (`icosphere` from the catalog, profile wall) | `convertSimplicialComplex` / `generateLibraryPrimitive` / `generateProfileExtrude` with explicit `cellSize` | Infer triangles vs quads from buffer length |
| glTF, OBJ, STL | `importGltf`, `importObj`, `importStlAscii` from `@modeling-kit/formats` | Run those files through `facesFromFlatCells` |
| Viewport picking, UVs, meshopt | `triangulateMesh` maps (`triangleFaceIds`, `vertexIdMap`, `cornerIdMap`) | Persist GPU indices |
| Save | `session.saveNativeJson()` | Treat an exported glTF as the document |

`PRIMITIVE_CATALOG` tells a host whether a public name is canonical or a library recipe. `apps/geometry-gallery` is the visual check of both. Interchange details: [Formats](formats.md).

## Next guides

- Fluent editor: [`fluent-editor.md`](fluent-editor.md)
- Viewport: [`viewport.md`](viewport.md)
- Selection / transform / snapping: [`selection-transform.md`](selection-transform.md)
- Formats (glTF/OBJ/STL): [`formats.md`](formats.md)
- AI tools: [`ai-tools.md`](ai-tools.md)
- Workers: [`workers.md`](workers.md)
- UV editing: [`uv-editor.md`](uv-editor.md)
- Tiled images and paint strokes: [`paint-image.md`](paint-image.md)
- Materials and texture sets: [`materials.md`](materials.md)
- Host examples: [`examples.md`](examples.md)
- Robust predicates vs `GeometryTolerance`: [`geometry-predicates.md`](geometry-predicates.md)
- Primitive-geometry conversion: [`primitive-geometry.md`](primitive-geometry.md)
- Polygon triangulation (ear clip vs Earcut): [`triangulation.md`](triangulation.md)
- Profile extrusion: [`profile-extrude.md`](profile-extrude.md)
- Derived mesh optimization: [`meshopt.md`](meshopt.md)
- Architecture: [`../architecture/sdk-architecture.md`](../architecture/sdk-architecture.md), [`../architecture/ownership.md`](../architecture/ownership.md)
- GPU ID-buffer picking: [`../architecture/GPU-ID-PICKING.md`](../architecture/GPU-ID-PICKING.md)
- 1.0 requirements: [`../architecture/modeling-operator-specification.md`](../architecture/modeling-operator-specification.md)
