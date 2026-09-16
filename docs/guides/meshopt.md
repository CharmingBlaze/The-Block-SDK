# Derived mesh optimization

**Package:** `@modeling-kit/meshopt` (optional)  
**Library:** `meshoptimizer` 1.2.0 (MIT)

This package never replaces the editable `HalfEdgeMesh`. It only consumes derived triangle buffers (render/export) and returns new typed arrays. The kernel, document, commands, and `@modeling-kit/sdk` do not depend on it.

## Ownership

| Layer | Owns |
| --- | --- |
| `HalfEdgeMesh` | Canonical topology and stable IDs |
| `triangulateMesh` | Derived positions/indices plus FaceId/VertexId/CornerId maps |
| `@modeling-kit/meshopt` | Reorder, vertex-cache/fetch locality, controlled simplification, LOD |
| Host / exporter | Whether to display or serialize the optimized arrays |

Do not import `meshoptimizer` from `@modeling-kit/mesh`, `@modeling-kit/document`, or `@modeling-kit/sdk`.

## Jobs and cleanup

`MeshoptOptimizer.run` starts a job (`queued` → `running` → `completed` / `failed` / `cancelling` → `disposed`). WASM modules load lazily via `MeshoptEncoder.ready` / `MeshoptSimplifier.ready`. One job runs at a time per optimizer instance.

- Cancel with `AbortSignal`. In-flight WASM is synchronous; cancel is observed before and after the call.
- A newer `run` on the same optimizer aborts the previous job (`cancelled` or `stale-revision`).
- Worker crash recovery: a thrown backend error is returned as `backend-failed`; the next job reloads WASM through `ready`.
- `dispose()` cancels the in-flight job. There is no result cache.
- Limits (`maxVertices`, `maxIndices`, `maxBytes`, `timeoutMs`) reject unreasonable requests before WASM runs.

Future workers can wrap the same `optimizeDerived` function and transfer typed arrays. This package does not start workers itself.

## Mapping

Reorder keeps triangle count. Source face IDs are remapped through the inverse vertex remap and reported as `mapping.status: "exact"` when every triangle is recovered.

Simplification may delete triangles. `mapping.status` is `partial` with `limitation: "simplification-dropped-triangles"`. Do not write simplified indices back into the kernel.

## Public API

- `optimizeDerivedTriangles(buffers, { mode, lod, signal })` — convenience one-shot
- `MeshoptOptimizer.run` / `dispose`
- `MeshoptRequest.mode`: `"reorder"` | `"simplify"`
- Optional `lodRatios` for extra simplified index buffers
- `MeshoptJobResult.ok` discriminates success from `cancelled` / `stale-revision` / `invalid-input` / `limit-exceeded` / `timeout` / `backend-failed` / `disposed`
