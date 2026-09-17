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

## Render modes

The turnkey Three.js viewport supports `solid`, `material`, `textured`, `unlit`, `wireframe`, `shaded-wireframe`, `normals`, `uv-checker`, and `game-preview`. Solid is the default. The controller contains no ambient-occlusion or screen-space post-processing pipeline.

```ts
const viewport = createThreeViewport({
  container,
  session,
  renderSettings: {
    mode: "solid",
    shadows: "medium", // off | low (512) | medium (1024) | high (2048)
    showGround: true,
    showGrid: true,
    showTopologyEdges: false,
    showTriangulation: false,
    flatShading: true,
    textureFiltering: "nearest",
  },
});

viewport.setRenderMode("shaded-wireframe");
viewport.updateRenderSettings({ shadows: "low", showGround: false });
```

All settings are presentation-only. They never edit canonical meshes, material records, textures, UVs, scene data, exports, selection IDs, or undo history. Solid uses a neutral studio material; Material suppresses texture maps while preserving material properties; Textured and Game Preview show assigned maps; Unlit uses color and texture without lights; Normals and UV Checker provide debugging views.

Wireframe and Shaded Wireframe use the adapter's canonical half-edge overlay, so quad and n-gon triangulation diagonals stay hidden unless `showTriangulation` is explicitly enabled. Boundary, ordinary topology, selected, crease/sharp, and seam edges retain distinct overlay styles.

One directional key light owns the only shadow map. The fill and rim lights never cast shadows. The shadow camera fits the selected object or visible scene with a maximum fit area, and a transparent ground receiver provides contact-style grounding from the same map. `shadowMap.autoUpdate` is disabled: document geometry, transform, visibility, selection, material, light, and setting changes explicitly invalidate the map. Static frames reuse it.

## Options

| Option | Default | Role |
| --- | --- | --- |
| `lighting` | `"studio"` | Hemisphere + 3-point studio lights, or `"none"` |
| `orbitControls` / `damping` | on / on | Right-drag orbit, middle-drag pan, wheel dolly when enabled |
| `autoResize` | on | `ResizeObserver` on `container` |
| `picking` | `true` | Left-click GPU ID-buffer object/face picks; `false` attaches no handlers |
| `pickDomain` | — | `"object"` / `"face"` / `"edge"` / `"vertex"` |
| `gpuPicking` | `true` when picking is on | Click backend. Hover stays CPU `Raycaster` |
| `onSelect` / `onHoverPick` | — | Click result vs pointer-move hover |
| `consumePick` | — | Async tool claim after pick. Prefer `viewport.gestures.registerTool` / `registerGizmo` |
| `gestureHooks` | — | Host `onPointerDown` may claim a gesture before the SDK assigns an owner |
| `navigation` | left none, middle pan, right orbit, wheel dolly, touch none | Public OrbitControls button map |
| `minDistance` | `2` when picking is on | Orbit floor so a leaked pinch cannot enter the mesh |
| `zoomToCursor` | `false` | Opt in; never enabled silently |
| `touchNavigation` | `false` | Sets `navigation.touch.twoFinger` to `"dolly-pan"` |
| `renderSettings` | Solid, medium shadows | Presentation-only mode, topology, texture, grid, ground, and shadow settings |

`picking: true` is convenience. Hosts that bind `@modeling-kit/input` should pass `picking: false` and call `viewport.resolvePointPick` / `adapter.pick` from `select.pick`. Viewport picking is not `bindDom`; do not wire them together. See [custom host picking](custom-host-picking.md).

## Pointer ownership

`createThreeViewport` owns one `ViewportGestureController` (`viewport.gestures`). It is the only SDK canvas pointer router. Each `pointerId` has exactly one owner for its lifetime: `selection`, `tool`, `gizmo`, `navigation`, or `none`.

OrbitControls is bound to an internal event gate, not the canvas. Selection/tool/gizmo events never become leftover Orbit pointers, so a later gesture cannot pinch-dolly into the mesh. Do not read or write OrbitControls private fields (`state`, `_pointers`, `_scale`, `_sphericalDelta`).

| Input | Action |
| --- | --- |
| Left click (movement ≤ ~4px) | Select via `pickPoint` → `applyPointPickToSelection`. No `setPointerCapture`. |
| Left drag | Not orbit. Tools/gizmos may claim via hooks, `registerGizmo` / `registerTool`, or `consumePick`. |
| Right drag | Orbit |
| Middle drag | Pan |
| Wheel | Dolly |
| Touch | Never selection. Navigation only if `navigation.touch` is configured |

Left pointerdown resolution:

1. Host `gestureHooks.onPointerDown`
2. Registered gizmo `hitTest`
3. Registered tool `hitTest`
4. Selection (mouse only, when picking is on)
5. Navigation only if that button is configured for it

```ts
viewport.gestures.setHooks({
  onPointerDown: (context) => {
    if (myTool.hit(context.event)) {
      return { owner: "tool", beginDrag: true };
    }
    return undefined;
  },
  onPointerMove: (context) => myTool.move(context.event),
  onPointerUp: (context) => myTool.commit(context.event),
  onPointerCancel: () => myTool.cancel(),
});

viewport.gestures.registerGizmo({
  hitTest: (context) => (gizmo.hit(context.event) ? { owner: "gizmo", beginDrag: true } : undefined),
  onPointerMove: (context) => gizmo.drag(context.event),
  onPointerUp: () => gizmo.commit(),
  onPointerCancel: () => gizmo.cancel(),
});

viewport.gestures.setNavigation({
  mouseButtons: { left: "none", middle: "pan", right: "orbit" },
  wheel: "dolly",
  touch: { oneFinger: "none", twoFinger: "none" },
});

viewport.gestures.cancelActiveGesture("selection-start");
```

`cancelActiveGesture` clears router state, releases pointer capture, and resets navigation through supported DOM/OrbitControls behavior. Call it on blur, tool switch, or whenever a host must abort a gesture.

Re-assigning `controls.mouseButtons.LEFT` to rotate while picking is on is ignored: the controller re-applies `navigation`. To orbit with the left button, pass `picking: false` and own picking yourself, or set `navigation.mouseButtons.left` through `viewport.gestures.setNavigation`.

`minDistance` defaults to 2 (never below 0.5). `zoomToCursor` stays false unless you pass `zoomToCursor: true`.

## Migration: raw canvas pointer listeners

Do not attach competing `pointerdown` / `pointermove` / `pointerup` handlers on the canvas, and do not add `window` listeners to recover from stale OrbitControls state.

| Old pattern | Replacement |
| --- | --- |
| `canvas.addEventListener("pointerdown", …)` to pick or drag a tool | `gestureHooks` or `viewport.gestures.setHooks` |
| Gizmo that calls `setPointerCapture` on every left down | `viewport.gestures.registerGizmo({ hitTest })` with `beginDrag: true` only when a handle is hit |
| Mutating `controls.state` / `_pointers` / `_sphericalDelta` after a click | `viewport.gestures.cancelActiveGesture("selection-start")` |
| `window` pointer listeners because canvas events never arrived | Hooks run inside the controller; you do not need a second DOM listener |

Observing canvas events (logging) is safe: the controller does not call `stopImmediatePropagation`. Claiming ownership through a second listener is not supported.

## Host gizmos

1. Register `hitTest` with `viewport.gestures.registerGizmo`. A gizmo claim and selection never start from the same event.
2. `consumePick` `{ consumed: true, beginDrag: true }` remains valid for async GPU hits. Capture is released on up/cancel/blur/dispose.
3. Do not apply scale/translate until pointer travel exceeds ~8–16px (`VIEWPORT_GIZMO_DRAG_SLOP_PX` is 12). A click on a combined handle must not mutate the object. If the gesture stays click-sized, restore the transform and do not write the document.

Do not let a gizmo call `setPointerCapture` on every left down independently of the controller. Combined-mode handles sit on the mesh; a click-sized capture starts scale/translate and explodes the object into the camera.

## Picking

Canonical policy (VP-003 / GPU-PICK-001):

- **Click object/face:** GPU ID-buffer (`adapter.pickPoint` / `viewport.resolvePointPick`). Face IDs are allocated per canonical face, not per render triangle. Pointer-down and pointer-up share a `PickSession` so backends cannot mix mid-gesture.
- **Surface XYZ:** GPU identity plus constrained CPU intersection of that face (`requireSurfacePoint`). Identity results never invent `{0, 0, 0}`.
- **Hover, vertices, edges, x-ray, select-through, no WebGL:** CPU `THREE.Raycaster` (`adapter.pick`). GPU hover is 1.1.
- **Object preference:** default `BvhSpatialQuery` (revision-aware AABB). Disable with `spatialAcceleration: false`. Mesh-local triangle queries use `MeshLocalBvh` (rebuild on topology, refit on positions).

Do not persist GPU indices. Maps from `triangulateMesh` (`triangleFaceIds`, `vertexIdMap`, `cornerIdMap`) are the only legal bridge.

Architecture: [`../architecture/three-adapter.md`](../architecture/three-adapter.md), [`../architecture/GPU-ID-PICKING.md`](../architecture/GPU-ID-PICKING.md).

Render-mode ownership, shadow invalidation, and resource budgets: [`../architecture/viewport-render-modes.md`](../architecture/viewport-render-modes.md).

## Handle

```ts
viewport.scene;
viewport.camera;
viewport.renderer;
viewport.adapter;
viewport.controls; // OrbitControls | undefined
viewport.gestures; // ViewportGestureController
viewport.display; // ViewportDisplayController (adapter-owned resources)
viewport.setRenderMode("wireframe");
viewport.updateRenderSettings({ shadows: "off", showGrid: false });
viewport.pickFromClient(clientX, clientY, domain);
await viewport.resolvePointPick(request);
viewport.applyPointPick(result, "replace"); // add | subtract | toggle
viewport.setKnifePreview({ cursor, segments });
viewport.dispose();
```

Knife overlay is host-driven. Transform gizmos are not built in; attach them to the adapter root and drive `session.beginTransform` / `updateTransform` / `commitTransform` / `cancelTransform`. See [Host gizmos](#host-gizmos).

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
