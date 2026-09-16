# GPU ID-buffer picking

**Owning package:** `@modeling-kit/three-adapter`  
**Neutral contracts:** `@modeling-kit/selection` (`PointPickRequest`, `PointPickResult`, `PickSession`)  
**Coordinator:** [`PICKING-COORDINATOR.md`](./PICKING-COORDINATOR.md)  
**Status:** GPU-PICK-001 click path is a 1.0 viewport capability. GPU hover, alpha cutouts, clipping-plane parity, `InstancedMesh`, GPU skinning, R32UI targets, and full-buffer lasso readback are 1.1.

Canonical identities remain branded strings on `ModelDocument` / `HalfEdgeMesh`. GPU pick IDs are transient numbers that exist only for one completed picking scene.

## Why hybrid picking

A GPU ID-buffer is accurate for **visible surfaces**: the frontmost shaded triangle wins because the GPU already depth-tests. It is a poor fit for vertices, edges, marquees, and headless tests.

| GPU ID-buffer | CPU spatial / screen-space |
| --- | --- |
| Visible object picking | Vertex picking |
| Visible face picking | Edge picking |
| Occlusion-aware click | Box / crossing / lasso |
| Frontmost rendered triangle | Select-through and x-ray |
| Optional object candidate | Headless tests, non-rendered geometry |

The GPU pass returns a **candidate**. `applyPointPickToSelection` in `@modeling-kit/selection` applies replace / add / toggle / subtract. Keyboard modifiers stay in the host.

## Identity model

Pick ID `0` is background. IDs `1…0xFFFFFF` are packed into RGB (24-bit). Canonical `ObjectId` / `MeshId` / `FaceId` values are never hashed or truncated into colors.

```text
pick ID → GpuPickRecord → objectId + optional meshId / FaceId
canonical FaceId is allocated once per face; every render triangle of that face outputs the same pick ID
triangle indices remain in triangulation data for CPU surface refinement only
```

Several render triangles may share one canonical n-gon `FaceId`. That is required. Render triangles are not editable faces and are not exposed as pick identities.

`InMemoryGpuPickRegistry` assigns IDs deterministically when a picking scene is built. ID `0` is background. IDs `1…0xFFFFFF` are valid. Allocation never wraps: overflow sets `diagnostics().idOverflow` and `pickPoint` falls back to CPU. `clear()` drops every entry so stale IDs cannot resolve after a rebuild. Object or face deletion tombstones matching rows.

Registry rebuild follows mesh/scene geometry revision. Camera motion rerenders; it does not rebuild picking geometry.

## Coordinate conversion

`clientToViewportPixel` is the only pointer-to-GPU conversion. It accounts for canvas offset, CSS size vs drawing-buffer size, device pixel ratio, split viewport rectangles, and top-left DOM vs bottom-left GL.

Hover still uses `clientToNdc` + CPU `Raycaster` so pointer-move never stalls on readback.

## Render-target rules

The picking target is 1×1 with `camera.setViewOffset` for the selected pixel.

- `NoToneMapping`, `LinearSRGBColorSpace` (not display-sRGB) so 24-bit IDs are not gamma-encoded. `NoColorSpace` is not a valid `renderer.outputColorSpace` in Three r180.
- Dedicated `ShaderMaterial` (not the visual PBR material)
- `NoBlending`, no transparency blending, no fog, no dithering, no lights, no textures
- Nearest filtering, depth test and depth write on
- No outline, no post-processing

**Performance tradeoff:** a 1×1 view-offset pass avoids a full-resolution ID buffer. View-offset is restored after the pick. If a host already drives complex multi-view camera offsets, prefer verifying perspective and orthographic picks in that layout.

Synchronous `readRenderTargetPixels` runs only on completed clicks (`pickPoint`). It does not run on pointermove.

## Visibility and materials

| Case | Policy |
| --- | --- |
| Hidden / `visible: false` | Not pickable |
| Locked / `selectable: false` | Not pickable (`getEffectiveSelectable`) |
| Camera layers | Object must match `camera.layers` |
| Isolation mode | Not in the document model yet; no extra filter |
| Backfaces | `PickBackfaceMode`, default `front-only` (visual default material is double-sided) |
| Opaque | Supported |
| Transparent solids | Depth-tested and pickable as solid |
| Alpha-tested cutouts | Treated as solid in this slice |
| Opacity 0 | Still pickable in this slice if the object is visible |
| X-ray / select-through | CPU path; GPU visible-surface result is skipped |
| Clipping planes | Not copied into the picking material in this slice |

## Instancing and skinning

Linked mesh instances are separate scene objects sharing derived `BufferGeometry`. Each has its own `objectId`.

`InstancedMesh` is **not** supported. Those objects are omitted from the picking scene rather than returning a shared mesh ID.

GPU face picking uses the same derived positions as the visual mesh, including **CPU-skinned** poses written by `applyCpuSkin`. GPU skinning shaders are not used. Returning rest-pose hits for a deformed visual mesh is forbidden; this slice reads the already-deformed visual buffers.

## Fallback

`ThreeViewportAdapter.pickPoint`:

1. Vertex / edge / x-ray / select-through / hover purpose → CPU `Raycaster`
2. GPU ID overflow, unavailable backend, or `gpuPicking: false` → CPU `Raycaster` when fallback is enabled
3. GPU backend active → identity from the ID buffer, including a real miss
4. When `requireSurfacePoint` is set, GPU identity is refined by intersecting **only** the identified canonical face

`adapter.pick` remains the synchronous CPU path used by hover. GPU hover is not implemented.

Diagnostics: `adapter.lastPickSource`, `adapter.lastPickFailure`, and `resourceDiagnostics().gpuPicking`.

## Module layout

Keep GPU picking and the viewport adapter as focused modules, not one file each:

| Module | Responsibility |
| --- | --- |
| `gpu-picking/encode.ts`, `registry.ts`, `types.ts` | Compact pick IDs and canonical lookup |
| `gpu-picking/material.ts`, `face-geometry.ts`, `pick-scene.ts` | Dedicated picking draw list |
| `gpu-picking/software-rasterizer.ts`, `webgl-readback.ts` | Readback backends |
| `gpu-picking/service.ts` | Orchestration only |
| `cpu-pick.ts`, `hybrid-pick.ts`, `pick-drawables.ts` | Adapter pick paths |
| `adapter-scene-sync.ts`, `adapter-overlay.ts`, `adapter-transform.ts`, `adapter-session-events.ts` | Scene mirror, overlays, pose, session wiring |
| `viewport-studio.ts`, `viewport-pointer.ts`, `viewport-types.ts` | Host viewport helpers |

Tests follow the same split: `gpu-picking-object`, `gpu-picking-face`, `gpu-picking-lifecycle`, plus encode/registry/pixel units.

## Hover (not in this slice)

`HoverPickPolicy` exists on the selection package (`minimumIntervalMs`, `regionSize`). Throttled GPU hover, scissored regions, and result caching are deferred to 1.1. Click and hover may use different spatial tolerance; they are not the same query.

## Disposal

`DefaultGpuPickingService.dispose()` drops render targets, owned materials, temporary face geometries, registry entries, and context-loss listeners. Pending `pick` promises settle with `undefined`. Double-dispose is a no-op.
