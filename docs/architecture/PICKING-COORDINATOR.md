# Picking coordinator

**Owning packages:** `@modeling-kit/selection` (neutral contracts) and `@modeling-kit/three-adapter` (GPU/CPU backends)  
**Related:** [`GPU-ID-PICKING.md`](./GPU-ID-PICKING.md), [`../guides/custom-host-picking.md`](../guides/custom-host-picking.md)

One pointer gesture uses **one** pick request, **one** backend policy, and **one** stored result.

```text
Pointer event
    → PickPurpose / PointPickRequest
    → resolvePickPolicy
    → GPU identity or CPU raycast
    → optional CPU face refinement
    → IdentityPickResult | SurfacePickResult
    → tool consumePick, then applyPointPickToSelection
```

## Identity versus surface

`IdentityPickResult` carries branded object/face identity and no position. A missing hit point stays missing. Callers that need XYZ must require `result.kind === "surface"` or `requireSurfacePick`.

`SurfacePickResult` is produced only after constrained CPU intersection of the identified canonical face. Coordinates are finite world/local points and normals. `(0,0,0)` is never substituted for a miss.

## Backend routing

| Request | Backend |
| --- | --- |
| Visible object/face selection | GPU identity |
| Face tool / knife / placement / measurement needing XYZ | GPU identity + CPU face refinement |
| Snap, vertex, edge | CPU |
| X-ray / select-through / `purpose: "hover"` | CPU |
| Headless / `gpuPicking: false` / `clickBackend: "cpu"` | CPU |
| Hover | CPU only (GPU hover is 1.1) |

Scene/visibility changes during a gesture **cancel** click selection. Camera or viewport changes **rerun** the same request and backend policy. Unchanged sessions **reuse** the pointer-down result. A rerun that would switch CPU↔GPU is cancelled instead of mixed.

## Gesture lifecycle

1. **Pointer down.** Build one `PointPickRequest`. Resolve it. Store a `PickSession`. Offer the result to `consumePick`.
2. **Pointer move.** Click-versus-drag uses host pixel tolerance. Drag tools may query separately. The stored click candidate is not replaced casually.
3. **Pointer up.** If still a click and the tool did not consume or begin a drag, reuse (or rerun) the session result. Selection uses **modifier state at pointerup**.

Empty GPU/CPU misses: replace clears; add / toggle / subtract leave the selection unchanged.

## Host responsibilities

The GPU service does not read the keyboard. Hosts translate modifiers into `SelectionIntent` (`replace` | `add` | `toggle` | `subtract`) and call `applyPointPick` / `applyPointPickToSelection`.

`createThreeViewport({ picking: false })` attaches no pointer handlers. `resolvePointPick` and `applyPointPick` remain available for custom hosts.

## Tool consumption

`consumePick` may return `boolean` or `{ consumed, beginDrag? }`. A consumed or dragging session does not run independent pointer-up selection. Tools that need a selection change call the selection controller themselves.

## Transparency, instancing, skinning (deferred)

Opaque geometry is supported. Transparent and alpha-tested surfaces are treated as solid depth-tested geometry. Clipping planes are not mirrored into the pick pass. `THREE.InstancedMesh` and GPU-skinned poses are unsupported: they are omitted or fail structured rather than returning a rest-pose or base-mesh identity.
