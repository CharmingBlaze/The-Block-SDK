# @modeling-kit/three-adapter

**Three.js viewport adapter for The Block SDK.** Synchronizes the canonical document with a Three.js scene, provides hybrid GPU/CPU picking, sub-element overlays, orbit navigation, and gesture routing.

## Purpose

The `three-adapter` package is the **rendering bridge** between the headless SDK and a Three.js viewport:

- **`ThreeViewportAdapter`** — synchronizes SDK meshes to `THREE.Mesh` instances with reactive revision tracking
- **`createThreeViewport()`** — one-call setup: renderer, camera, lights, grid, orbit controls, resize handling, picking
- **Hybrid picking** — GPU ID-buffer picking (click) + CPU raycaster (hover/vertices/edges) with fallback chains
- **Sub-element overlays** — renders vertex markers, edge lines, and face highlights atop the mesh
- **Viewport gesture system** — front-end gesture controller routing pointer events between orbit navigation, picking, and tools
- **Animation rendering** — CPU skinning, Three.js `AnimationMixer` integration, skeleton visualization
- **Display settings** — configurable render modes (solid, wireframe, x-ray, material preview), shadows, GTAO

## Key Exports

```ts
// Main adapter
import {
  ThreeViewportAdapter, createThreeViewport,
  type ThreeViewportAdapterOptions,
  type CreateThreeViewportOptions, type ThreeViewportHandle,
  type ViewportRenderer,
} from "@modeling-kit/three-adapter";

// Picking
import {
  pickEdgeOnFace, pickVertexOnFace, resolveFaceId,
  type PickDomain, type PickResult, type PickingOptions,
} from "@modeling-kit/three-adapter";

// GPU picking
import {
  DefaultGpuPickingService, encodePickId, decodePickId,
  createFacePickingGeometry, createFacePickingMaterial,
  createObjectPickingMaterial, softwarePickAtPixel,
  type GpuPickingService, type GpuPickRecord,
  type GpuPickingReadback, type GpuPickingDiagnostics,
} from "@modeling-kit/three-adapter";

// Sub-element visuals
import {
  SubElementVisualizer, ElementPointerMachine,
  defaultSubElementTheme, defaultSubElementDisplay,
  resolveElementVisualState, planElementLod,
  type SubElementDisplayOptions, type SubElementVisualTheme,
  type ElementVisualState, type ElementDomain,
} from "@modeling-kit/three-adapter";

// Geometry sync
import {
  createBufferGeometry, syncDerivedGeometry,
  type RenderMapping,
} from "@modeling-kit/three-adapter";

// Materials
import {
  createStandardMaterial, defaultViewportMaterial,
} from "@modeling-kit/three-adapter";

// Display settings
import {
  DEFAULT_VIEWPORT_RENDER_SETTINGS,
  DEFAULT_VIEWPORT_DISPLAY_SETTINGS,
  ViewportDisplayController,
  resolveViewportRenderSettings,
  resolveViewportDisplaySettings,
  type ViewportRenderMode, type ViewportDisplayMode,
  type ViewportRenderSettings, type ViewportDisplaySettings,
} from "@modeling-kit/three-adapter";

// Spatial query
import {
  createBvhSpatialQuery, AabbTreeSpatialQuery,
  type SpatialQueryBackend, type SpatialAabb, type SpatialHit,
} from "@modeling-kit/three-adapter";

// Overlays
import {
  buildSelectionOverlay, createKnifeOverlay, updateKnifeOverlay,
  type KnifeOverlayState,
} from "@modeling-kit/three-adapter";
```

## Animation & Rigging Exports

```ts
import {
  createThreeSkeleton, createThreeSkinnedMesh,
  updateThreeSkeleton, disposeThreeSkeleton,
  createThreeAnimationClip, createThreeAnimationMixer,
  playThreeClip, updateThreeAnimation, disposeThreeAnimation,
  applyCpuSkin,
## Usage Example

```ts
import { createThreeViewport } from "@modeling-kit/three-adapter";
import { createEditor } from "@modeling-kit/sdk";

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
      editor.selection.set({ domain: hit.domain, ids: [hit.id] });
    }
  },
  subElement: {
    theme: defaultSubElementTheme,
    display: { vertices: true, edges: true },
  },
});

editor.spawn.cube({ size: 2 });
// Cube appears in the viewport immediately

// Display knife preview
viewport.setKnifePreview({
  cursor: [0, 1, 0],
  segments: [[[-1, 1, 0], [1, 1, 0]]],
});

viewport.dispose();
editor.dispose();
```

## Architecture Notes

- **`ThreeViewportAdapter`** is the central class — ownership is flexible: `createThreeViewport()` owns its adapter; you can also create an adapter directly and manage lifecycle yourself.
- **Revision-driven sync** — meshes are only rebuilt when their revision counters change. The adapter uses granular dirty flags for topology, positions, UVs, seams, and materials.
- **Hybrid picking**: GPU ID-buffer for clicks (supports 16M+ IDs via RGB encoding), CPU `Raycaster` for hover and sub-element picking, with software rasterizer fallback.
- **MeshVisualScheduler** batches visual updates and only rebuilds geometry when the current frame needs it.
- **`ViewportGestureController`** routes pointer events through a priority chain: tools → gizmos → orbit controls → picking. Only the first claimant handles the event.
- **`SubElementVisualizer`** creates instanced meshes for vertices (circles) and edges (lines) — these sit on a dedicated overlay layer and update incrementally.
- GPU resources (geometries, materials, textures, render targets) are **disposed** on `dispose()` — no leaks.
- See `docs/architecture/three-adapter.md` for detailed architecture and performance characteristics.
  type AnimationPlaybackHandle,
} from "@modeling-kit/three-adapter";
```

## Gesture & Navigation Exports

```ts
import {
  createViewportGestureController, createOrbitEventGate,
  bindViewportPointerRouter,
  type ViewportGestureController,
  type ViewportNavigationConfig,
  type ViewportGestureClaim, type ViewportGestureOwner,
  type ViewportPointerRouter,
} from "@modeling-kit/three-adapter";
```