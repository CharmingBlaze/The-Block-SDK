# Three.js Adapter Architecture

**Package:** `@modeling-kit/three-adapter`  
**Peer Dependency:** `three` (^0.160.0 or higher)  
**License posture:** Clean-room independent implementation.

---

## 1. Role and Core Principle

The Three.js adapter is a **strictly derived view** of the canonical `ModelDocument` and `EditorSession`.

Hard invariants:

1. `THREE.BufferGeometry` is **never** the editable source of truth.
2. Editing operations never mutate Three.js objects directly.
3. The adapter subscribes to `DocumentChangeSet` events and performs **incremental GPU resource updates**.
4. The adapter never assumes ownership of the DOM canvas, camera creation, or UI layout. The host application provides camera, scene, and renderer.
5. Multiple adapters can view the same `EditorSession` concurrently (e.g. 4-quad view: Top, Front, Right, Perspective).

---

## 2. Adapter Lifecycle and Interface

```ts
import * as THREE from "three";
import { EditorSession } from "@modeling-kit/core";

export interface ThreeViewportAdapterOptions {
  readonly session: EditorSession;
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly renderer: THREE.WebGLRenderer;
}

export class ThreeViewportAdapter {
  constructor(options: ThreeViewportAdapterOptions);

  /** Mounts event listeners to session and populates initial 3D objects */
  mount(): void;

  /** Forces full or incremental reconciliation of dirty scene elements */
  sync(): void;

  /** Updates camera aspect ratio and renderer dimensions */
  resize(width: number, height: number, pixelRatio?: number): void;

  /** Disposes GPU buffers, materials, picking render targets, and event listeners */
  dispose(): void;
}
```

---

## 3. Geometry Derivation Pipeline

When a mesh changes, the adapter updates a corresponding `THREE.Mesh`:

```
Canonical Mesh (Kernel)
       │
       ▼ Polygon Triangulation & Seam Splitting
Triangulated Buffers:
  - position: Float32Array (3 floats per vertex)
  - normal: Float32Array (3 floats per vertex)
  - uv: Float32Array (2 floats per vertex)
  - faceIdMap: Uint32Array (index -> FaceId lookup table)
  - vertexIdMap: Uint32Array (index -> VertexId lookup table)
       │
       ▼ Wrap in THREE.BufferGeometry
THREE.BufferGeometry attached to THREE.Mesh
```

### 3.1 Seam Splitting and Vertex Normal Smoothing

- Shared vertices with distinct corner UVs (UV seams) or distinct corner normals (sharp edges, dihedral angle > crease threshold) are split into separate render vertices.
- For flat-shaded faces, face normals are computed and assigned to all vertices of that face.
- For smooth-shaded faces, vertex normals are computed via area-weighted or angle-weighted averages of incident face normals.

---

## 4. Raycasting & Picking System

Canonical picking is hybrid (VP-003 / GPU-PICK-001):

- **Click object/face:** GPU ID-buffer in `@modeling-kit/three-adapter` (`adapter.pickPoint` / `viewport.resolvePointPick`). Canonical `FaceId`s are allocated per face, not per render triangle. Gesture state lives in `PickSession` so pointer-down and pointer-up cannot mix CPU and GPU candidates.
- **Surface XYZ:** GPU identity plus constrained CPU intersection of that face (`requireSurfacePoint` / knife / placement / measurement). Identity results never invent `{0,0,0}`.
- **Hover, vertices, edges, x-ray, select-through, no WebGL:** CPU `THREE.Raycaster` (`adapter.pick`). GPU hover is not in 1.0.

Do not describe CPU raycasting as “GPU raycast.” The ID-buffer pass is documented in [`GPU-ID-PICKING.md`](./GPU-ID-PICKING.md).

Neutral contracts (`VisibilityPickingAdapter`, `PointPickRequest`, `applyPointPickToSelection`) live in `@modeling-kit/selection` and must not import Three.js.

Optional object-level acceleration implements `SpatialQueryBackend` (VP-005). `BruteForceSpatialQuery` is a host-replaceable stand-in, not `three-mesh-bvh`. A null spatial result means “no preference”; CPU picking still uses the raycaster. Hosts own backend lifetime unless `ownsSpatialQuery` is true. `PickRequestGate` drops stale pick generations.

Picking translates screen pointer coordinates $(x, y)$ into canonical domain selections:

```ts
export interface PickingOptions {
  readonly domain: "object" | "face" | "edge" | "vertex";
  readonly pixelHitRadius: number;
  readonly frontFacingOnly: boolean;
}

export interface PickResult {
  readonly domain: "object" | "face" | "edge" | "vertex";
  readonly objectId: ObjectId;
  readonly elementId: ObjectId | FaceId | EdgeId | VertexId;
  readonly point: THREE.Vector3;
  readonly distance: number;
}
```

### 4.1 Resolution Algorithm

1. **CPU Raycast:** `THREE.Raycaster` against derived viewport meshes (not a GPU ID buffer).
2. **Face Resolution:** Read the raycast intersection's `faceIndex`. Query the geometry's `faceIdMap` to resolve the canonical `FaceId`.
3. **Vertex / Edge Resolution:**
   - In vertex/edge domain, raycast uses hit-distance thresholds in screen space against projected vertex markers or edge segments.
   - Screen-space thresholding accounts for perspective/orthographic projection and DPR.

---

## 5. Overlay Renderers & Gizmos

The adapter maintains auxiliary Three.js overlay objects that render on top of the model:

1. **Selection Outlines & Highlights:**
   - Face highlighting: Overlay mesh rendered with polygon offset.
   - Edge highlighting: Highlighted line segments referencing selected `EdgeId`s.
   - Vertex handles: Billboards or point clouds highlighting selected `VertexId`s.
2. **Transform Gizmos:** Standard translate, rotate, and scale gizmo handles aligned with active transform space (`world`, `local`, `parent`, or `normal`).
3. **Construction Guides:** Ground grid, 3D cursor position, pivot marker, and snapping candidate indicators.

---

## 6. Resource Management & Clean Disposal

To prevent memory leaks in web applications:

- Every generated `THREE.BufferGeometry` and `THREE.Material` is tracked.
- When meshes are updated, old buffer attributes are reused where buffer size permits, or cleanly disposed (`geometry.dispose()`) before replacement.
- Calling `adapter.dispose()` unbinds all session subscriptions and cleans all allocated GPU resources.
