# Getting started

`modeling-kit` is a headless TypeScript SDK. Hosts own cameras, renderers, and UI.

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
```

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
```

Install from this monorepo with pnpm workspaces. Packages are private (`UNLICENSED`) until a licence is chosen.

There is no Minecraft, `.bbmodel`, or game-format support. Native JSON is the only persistence format in Phase 1.

UV editing (headless, one command per committed transform) is documented in [`uv-editor.md`](uv-editor.md). Tiled images and paint strokes are in [`paint-image.md`](paint-image.md). Materials and texture sets are in [`materials.md`](materials.md).
