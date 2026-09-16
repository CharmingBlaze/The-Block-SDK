# Viewport

Hosts own the canvas. `@modeling-kit/three-adapter` derives GPU meshes, overlays, and picking from `ModelingSession`. It never owns the editable kernel.

Two entry points:

1. **`createThreeViewport`** — turnkey renderer, perspective camera, studio lights, grid, OrbitControls, resize, picking.
2. **`ThreeViewportAdapter`** — you already have a `THREE.Scene`, camera, and `WebGLRenderer`.

```ts
import { createEditor } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/three-adapter";
// or: import { createThreeViewport } from "@modeling-kit/sdk/three";

const editor = createEditor();
const viewport = createThreeViewport({
  container: document.getElementById("viewport")!,
  session: editor.session,
  grid: true,
  lighting: "studio", // alias: lights: true
  camera: { fov: 45, position: [5, 5, 7] },
  orbitControls: true,
  damping: true,
  autoResize: true,
  picking: true,
  pickDomain: "face",
  onSelect: (hit) => {
    if (hit) console.log(hit.kind, hit.domain, hit.objectId);
  },
});

editor.spawn.cube({ size: 2 });
viewport.dispose();
editor.dispose();
```

Dispose the viewport, then the editor or session. Multiple adapters may view one session (four-quad layouts).

## Options

| Option | Default | Role |
| --- | --- | --- |
| `lighting` | `"studio"` | Hemisphere + 3-point studio lights, or `"none"` |
| `orbitControls` / `damping` | off / off | Right-drag orbit, middle-drag dolly when enabled |
| `autoResize` | off | `ResizeObserver` on `container` |
| `picking` | `true` | Left-click GPU ID-buffer object/face picks; `false` attaches no handlers |
| `pickDomain` | — | `"object"` / `"face"` / `"edge"` / `"vertex"` |
| `gpuPicking` | `true` when picking is on | Click backend. Hover stays CPU `Raycaster` |
| `onSelect` / `onHoverPick` | — | Click result vs pointer-move hover |
| `consumePick` | — | Tools can swallow a click (`ToolPickResponse`) |

`picking: true` is convenience. Hosts that bind `@modeling-kit/input` should pass `picking: false` and call `viewport.resolvePointPick` / `adapter.pick` from `select.pick`. See [custom host picking](custom-host-picking.md).

## Picking

Canonical policy (VP-003 / GPU-PICK-001):

- **Click object/face:** GPU ID-buffer (`adapter.pickPoint` / `viewport.resolvePointPick`). Face IDs are allocated per canonical face, not per render triangle. Pointer-down and pointer-up share a `PickSession` so backends cannot mix mid-gesture.
- **Surface XYZ:** GPU identity plus constrained CPU intersection of that face (`requireSurfacePoint`). Identity results never invent `{0, 0, 0}`.
- **Hover, vertices, edges, x-ray, select-through, no WebGL:** CPU `THREE.Raycaster` (`adapter.pick`). GPU hover is 1.1.
- **Object preference:** default `BvhSpatialQuery` (revision-aware AABB). Disable with `spatialAcceleration: false`.

Do not persist GPU indices. Maps from `triangulateMesh` (`triangleFaceIds`, `vertexIdMap`, `cornerIdMap`) are the only legal bridge.

Architecture: [`../architecture/three-adapter.md`](../architecture/three-adapter.md), [`../architecture/GPU-ID-PICKING.md`](../architecture/GPU-ID-PICKING.md).

## Handle

```ts
viewport.scene;
viewport.camera;
viewport.renderer;
viewport.adapter;
viewport.controls; // OrbitControls | undefined
viewport.pickFromClient(clientX, clientY, domain);
await viewport.resolvePointPick(request);
viewport.applyPointPick(result, "replace"); // add | subtract | toggle
viewport.setKnifePreview({ cursor, segments });
viewport.dispose();
```

Knife overlay is host-driven. TransformControls are not built in; attach gizmos to the adapter root and drive `session.beginTransform` / `updateTransform` / `commitTransform` / `cancelTransform`.

## Adapter-only mount

```ts
import * as THREE from "three";
import { ThreeViewportAdapter } from "@modeling-kit/three-adapter";

const adapter = new ThreeViewportAdapter({
  session,
  scene,
  camera,
  renderer,
});
adapter.mount();
adapter.sync();
adapter.dispose();
```

The adapter subscribes to document events. `document:changed.kind` of `transform` updates matrices only; `visibility` / `name` skip geometry rebuild.
