# @modeling-kit/uv

**Complete UV mapping and unwrapping system for The Block SDK.** Per-corner UV storage, multi-channel support, seam editing, island detection, projections (planar/box/cylindrical/spherical), automatic unwrap (xatlas LSCM/ARAP via workers), packing, and a headless UV editor with selection/transform/view-adapters.

## Purpose

### UV Data Layer
- **Corner UVs** — read/write per-corner `[u, v]` with revision tracking
- **UV pinning** — lock corners during unwrap/transform operations
- **Multi-channel** — support for `"default"`, `"lightmap"`, and custom channels
- **Bounds normalization** — fit UV islands to 0–1 space

### Seams & Islands
- **Seam editing** — mark/unmark edges, toggle, clear all, auto-mark boundaries
- **Island extraction** — connected UV components separated by seams
- **Boundary detection** — open edges are automatically seams

### Projections (Quick Mapping)
- **Planar** — project from a plane along an axis
- **Box** — 6-plane axis-aligned projection (best for hard-surface)
- **Cylindrical** — wrap-around projection
- **Spherical** — latitude/longitude projection
- **Per-face smart** — automatic best-axis per face

### Automatic Unwrapping (xatlas)
- **xatlas backend** — LSCM/ARAP parameterization via web workers
- **Chart segmentation** — automatic or target chart count
- **Pin boundary** — lock island borders during unwrap
- **Distortion metrics** — angle/area distortion analysis

### UV Packing
- **Bin-packing** — efficient rectangle packing with configurable margin
- **Island rotation** — optional 90° rotations for better fit

### UV Editor (Headless)
- **Selection** — vertex/edge/face/island with replace/add/remove/toggle
- **Marquee/Lasso** — box-select or freeform polygon select
- **Transform** — move/rotate/scale selected UVs with pin respect
- **Linked/grow/shrink** — topology-aware selection expansion
- **3D sync** — bidirectional selection sync with 3D viewport
- **View adapters** — pluggable rendering backends

## Key Exports

```ts
import {
  // Corner UVs
  getCornerUv, setCornerUv, setCornerUvs, setCornerPinned, isCornerPinned,
  normalizeUvBounds, describeCornerLoop,
  // Channels
  DEFAULT_UV_CHANNEL, createDefaultUvChannel, createUvChannel,
  type UVChannel, type UVChannelPurpose,
  // Seams & Islands
  edgeHasSeam, setEdgeSeam, toggleSeams, clearAllSeams, markBoundarySeams,
  extractUvIslands, findUvIslands, type ConnectedUvIsland,
  // Projections
  projectPlanar, projectBox, projectCylindrical, projectSpherical,
  projectPlanarUv, projectBoxUv, projectCylindricalUv, projectSphericalUv,
  projectUvs, type UvProjection, type ProjectUvsOptions,
  // Auto unwrap
  automaticUnwrap, applyAutomaticUnwrapResult, prepareAutomaticUnwrap,
  computeUvCharts, parameterizeUvCharts, packUvCharts, packUvIslands,
  createXAtlasUnwrapBackend, setUvUnwrapBackend, getUvUnwrapBackend,
  type AutomaticUvUnwrapOptions, type UvUnwrapBackend,
  // Packing
  packUvs, type PackUvsOptions,
  // Operations
  resetUvs, snapUvsToPixels, splitUvsAtVertex, texelDensity,
  transformUvCorners, weldUvs, type UvTransform,
  // Topology
  UvTopologyCache, buildDerivedUvTopology, getOrBuildUvTopology,
  type UVTopology, type UVVertex, type UVEdge, type UVFace, type UVIsland,
  // Selection
  UVSelection, type UVSelectionMode, type UVSelectionHit,
  // Marquee / lasso
  uvIdsInBox, uvIdsInPolygon, normalizeUvBox, type UvBox,
  // Picking
  pickUv, type UVPickHit,
  // Visual
  DEFAULT_UV_THEME, themeForPreset, hitRadiusUv,
  type UVVisualTheme, type UVEditorPreset,
  // View data & adapter
  buildUvViewData, UVViewAdapter, type UVViewData, type UVViewAdapterOptions,
  // Editor
  UVEditor, createUvEditor, type CreateUvEditorOptions, type UVCornerPatch,
  // Transform session
  UvTransformSession, type UVTransformRequest, type UVTransformDelta,
  // Analysis
  analyzeUvMesh, computeUvBounds, type UvAnalysis,
} from "@modeling-kit/uv";
```
## Usage Examples

### Quick Projection + Pack

```ts
import { projectBox, packUvs } from "@modeling-kit/uv";
projectBox(mesh, { channel: "default", size: [2, 2, 2] });
packUvs(mesh, { channel: "default", margin: 0.004 });
```

### Automatic Unwrap

```ts
import { automaticUnwrap, applyAutomaticUnwrapResult, packUvs, markBoundarySeams } from "@modeling-kit/uv";

markBoundarySeams(mesh);
const result = await automaticUnwrap(mesh, {
  channel: "default", method: "lscm", chartCount: 0, pinBoundary: true,
});
applyAutomaticUnwrapResult(mesh, result);
packUvs(mesh, { channel: "default", margin: 0.004, rotate: true });
```

### Headless UV Editor

```ts
import { createUvEditor } from "@modeling-kit/uv";

const editor = createUvEditor({
  mesh, meshId: "my-mesh", channelId: "default",
  textureResolution: { width: 1024, height: 1024 },
  preset: "professional", syncSelection: true,
  onCommit: (patch) => executeCommand(new ProjectUvCommand(patch)),
  onFacesSelected: (faceIds) => viewport.selectFaces(faceIds),
});

editor.pointerDown([0.5, 0.5], { mode: "face" });
editor.pointerUp([0.5, 0.5]);

// Box-select
editor.pointerDown([0.2, 0.2]);
editor.pointerMove([0.8, 0.8]);
editor.pointerUp([0.8, 0.8]);

// Transform
editor.beginTransform({ operation: "move" });
editor.updateTransform({ translate: [0.1, 0.0] });
const result = editor.commitTransform();

editor.dispose();
```

### Seam Editing

```ts
import { setEdgeSeam, toggleSeams, markBoundarySeams, extractUvIslands } from "@modeling-kit/uv";

setEdgeSeam(mesh, "e-0", true);
toggleSeams(mesh, ["e-2", "e-3"]);
markBoundarySeams(mesh);
const islands = extractUvIslands(mesh, "default");
```

### UV Operations

```ts
import { resetUvs, snapUvsToPixels, weldUvs, texelDensity } from "@modeling-kit/uv";

resetUvs(mesh, "default");                       // Reset to default projection
snapUvsToPixels(mesh, 1024, 1024, "default");     // Snap to pixel grid
weldUvs(mesh, 0.0001, "default");                 // Merge nearby UVs
const density = texelDensity(mesh, "default");     // Check texel density
```

## Architecture Notes

- UV data is stored **per-corner** on the half-edge mesh — each `CornerRecord` has `uv: [u, v]` and optional `pinnedUvChannels`.
- **Multi-channel** UVs are stored in `corner.uvChannels: Record<UVChannelId, [u, v]>` — the default channel also populates `corner.uv` for backward compatibility.
- **Seams** are boolean flags on mesh edges — the `UVTopology` cache builds the derived UV graph respecting seams.
- `automaticUnwrap` runs xatlas in a **web worker** via `@modeling-kit/workers` for non-blocking unwrap.
- `UvEditor` is **completely headless** — no rendering, no DOM, no Three.js dependency. Hosts provide their own UV viewport via `UVViewAdapter`.
- `UVViewAdapter` produces `UVViewData` — a structured draw-data payload renderable by any backend (Three.js, Canvas 2D, SVG, WebGPU).
- `UvTopologyCache` provides incremental rebuild — only invalidates when the mesh revision changes.
- See `docs/guides/uv-editor.md` for the full UV editing workflow.