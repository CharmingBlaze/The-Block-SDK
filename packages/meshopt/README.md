# @modeling-kit/meshopt

**Triangle optimization using meshoptimizer.** Reorders triangle indices for GPU cache efficiency, overdraw reduction, and vertex fetch optimization. Optional LOD generation.

## Purpose

The `meshopt` package wraps the [meshoptimizer](https://github.com/zeux/meshoptimizer) library to:

- **Optimize derived triangles** — reorder indices and vertices for GPU cache locality and vertex fetch bandwidth reduction
- **Vertex cache optimization** — improves post-T&L cache hit rate by up to 50%
- **Overdraw reduction** — reorders clusters to minimize pixel overdraw
- **LOD levels** — generate simplified geometry levels (optional)
- **Worker integration** — optimization runs in compute workers via the job system

## Key Exports

```ts
import {
  MeshoptOptimizer,
  derivedFromTriangulated,
  optimizeDerivedTriangles,
} from "@modeling-kit/meshopt";

// Limits
import {
  DEFAULT_MESHOPT_LIMITS, resolveLimits,
  type MeshoptLimits,
} from "@modeling-kit/meshopt";

// Types
import type {
  DerivedTriangleBuffers, MappingStatus,
  MeshoptFailure, MeshoptSuccess,
  MeshoptJobResult, MeshoptJobState,
  MeshoptLodLevel, MeshoptMode,
  MeshoptRequest, OptimizedTriangles,
  TriangleMapping,
} from "@modeling-kit/meshopt";
```

## Usage Example

```ts
import { MeshoptOptimizer, derivedFromTriangulated } from "@modeling-kit/meshopt";
import { triangulateMesh } from "@modeling-kit/mesh";

// Triangulate the half-edge mesh
const tri = triangulateMesh(mesh);

// Extract derived triangle buffers
const derived = derivedFromTriangulated(tri);

// Optimize
const result = await MeshoptOptimizer.optimize(derived, {
  vertexCache: true,
  overdraw: true,
  vertexFetch: true,
});

// Use optimized buffers for rendering
console.log(result.indices); // reordered index buffer
console.log(result.vertexRemap); // vertex position remap table
```

## Architecture Notes

- This package is **explicitly optional** — the SDK functions fully without meshoptimizer.
- `derivedFromTriangulated` converts from the SDK's `TriangulatedMesh` format to the raw index/vertex buffers meshoptimizer expects.
- Optimization is **read-only** on the canonical mesh — it only affects derived render data.
- `MeshoptJobResult` supports worker-based execution for large meshes.
- LOD generation is a planned feature (see `MeshoptLodLevel` type).
- See `docs/guides/meshopt.md` for performance benchmarks and configuration.