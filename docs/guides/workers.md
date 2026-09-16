# Workers

Heavy triangulation, UV packing, UV unwrap, and mesh validation can run on `@modeling-kit/workers`. Hosts construct a pool and call `dispose()` on unmount. There is no process-wide shared pool.

| Import | Runtime |
| --- | --- |
| `@modeling-kit/sdk` or `@modeling-kit/workers` | Inline cooperative fallback (scripts, Node TypeScript, tests) |
| `@modeling-kit/workers/browser` | `createBrowserComputePool()` — module `Worker`, transferable buffers |
| `@modeling-kit/workers/node` | `createNodeComputePool()` — `worker_threads` |

The headless SDK re-exports the runtime-neutral pool so browser example apps do not pull Node types. Bundlers that honor the `browser` / `node` export conditions resolve `@modeling-kit/workers` to the matching adapter.

```ts
import { createInlineComputePool } from "@modeling-kit/sdk";
// Browser: import { createBrowserComputePool } from "@modeling-kit/workers/browser";
// Node:    import { createNodeComputePool } from "@modeling-kit/workers/node";

const pool = createInlineComputePool();
try {
  const tri = await pool.triangulateAsync(serializedMesh);
  const packed = await pool.packUvsAsync(serializedMesh);
  const report = await pool.validateAsync(serializedMesh);
  const uvs = await pool.unwrapUvAsync(unwrapPayload);
} finally {
  pool.dispose();
}
```

Jobs accept an optional `AbortSignal`. A disposed pool rejects new work. Worker crash replacement is the adapter’s job; the next task gets a fresh worker.

## Jobs

| Method | Task type | Notes |
| --- | --- | --- |
| `triangulateAsync` | `triangulate` | Derived triangles + FaceId maps. Not an editable kernel. |
| `packUvsAsync` | `pack-uv` | Shelf pack on a serialized mesh |
| `validateAsync` | `validate` | Manifold / degeneracy report |
| `unwrapUvAsync` | `unwrap-uv` | Automatic chart unwrap backend |

Paint, format IO, and GPU picking stay on the main thread until they have their own task types.

## What workers are not

- They do not mutate `HalfEdgeMesh` in place.
- They do not replace `@modeling-kit/meshopt`. Meshopt is an optional derived-triangle adapter you call from the host after triangulation; see [meshopt](meshopt.md).
- They are not a required SDK global. Skip the pool for small scripts.
