# Getting started

`modeling-kit` is a headless TypeScript SDK. Hosts own cameras, renderers, and UI. The systems list, AI tools, and workers live in the [root README](../../README.md).

Public packages are MIT-licensed. There is no Minecraft, `.bbmodel`, or game-format support. Native JSON is the canonical persistence format.

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

## Viewport (host-owned Three.js)

```ts
import * as THREE from "three";
import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
} from "@modeling-kit/sdk";
import { ThreeViewportAdapter } from "@modeling-kit/three-adapter";

const session = createModelingSession(createSequenceIdFactory("demo"));
const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
session.selection.replace({
  domain: "face",
  objectId: cube.objectId,
  elementIds: [cube.faceIds.top],
});
session.execute(new ExtrudeFacesCommand({ distance: 1 }));

const adapter = new ThreeViewportAdapter({
  session,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
  renderer, // host WebGLRenderer
});
adapter.mount();
adapter.dispose();
session.dispose();
```

Turnkey helper: `createThreeViewport` from `@modeling-kit/three-adapter` (or `@modeling-kit/sdk/three`). Dispose the viewport, then the editor or session.

## Workers

Heavy triangulation, UV packing, and mesh validation can run on `@modeling-kit/workers`. Construct a pool and dispose it with the editor:

- `@modeling-kit/sdk` / `@modeling-kit/workers` — inline (scripts and headless TypeScript)
- `@modeling-kit/workers/browser` — `createBrowserComputePool()`
- `@modeling-kit/workers/node` — `createNodeComputePool()`

## Next guides

- UV editing (headless, one command per committed transform): [`uv-editor.md`](uv-editor.md)
- Tiled images and paint strokes: [`paint-image.md`](paint-image.md)
- Materials and texture sets: [`materials.md`](materials.md)
- Robust predicates vs `GeometryTolerance`: [`geometry-predicates.md`](geometry-predicates.md)
- Architecture and ownership: [`../architecture/sdk-architecture.md`](../architecture/sdk-architecture.md), [`../architecture/ownership.md`](../architecture/ownership.md)
- 1.0 requirements: [`../architecture/modeling-operator-specification.md`](../architecture/modeling-operator-specification.md)
