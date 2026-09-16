# Derived mesh optimization

**Package:** `@modeling-kit/meshopt` (optional)  
**Library:** `meshoptimizer` 1.2.0 (MIT)

This package never replaces the editable `HalfEdgeMesh`. It only consumes derived triangle buffers (render/export) and returns new typed arrays.

## Ownership

| Layer | Owns |
| --- | --- |
| `HalfEdgeMesh` | Canonical topology and stable IDs |
| `triangulateMesh` | Derived positions/indices plus FaceId/VertexId/CornerId maps |
| `@modeling-kit/meshopt` | Reorder, vertex-cache/fetch locality, controlled simplification, LOD |
| Host / exporter | Whether to display or serialize the optimized arrays |

Do not import `meshoptimizer` from `@modeling-kit/mesh`, `@modeling-kit/document`, or `@modeling-kit/sdk`.

## Jobs and cleanup

`MeshoptOptimizer` / `optimizeDerivedTriangles` load WASM lazily. A newer `run` aborts the previous job (`stale-revision` / `cancelled`). `dispose()` aborts in-flight work. There is no result cache.

- Cancel with `AbortSignal` before WASM starts.
- Worker crash recovery: a thrown backend error fails that job; the next `run` reloads encoder/simplifier.
- Limits reject unreasonable vertex/index/byte counts. `timeoutMs` bounds queued WASM work.

Future workers can wrap the same `optimizeDerived` function and transfer typed arrays. This package does not start workers itself.

## Mapping

Reorder keeps triangle count. Source face IDs are remapped through the vertex remap and reported as `mapping.status: "exact"` when every triangle is recovered.

Simplification may delete triangles. `mapping.status` is `partial` with `limitation: "simplification-dropped-triangles"`. Do not write simplified indices back into the kernel.

## Public API

- `optimizeDerivedTriangles(buffers, { mode, lod, signal })`
- `MeshoptOptimizer` for overlapping runs (latest revision wins)
- `MeshoptRequest.mode`: `"reorder"` | `"simplify"`
