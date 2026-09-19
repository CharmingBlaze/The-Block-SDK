# @modeling-kit/mesh

**Half-edge mesh kernel and topology operations.** The canonical mesh representation for The Block SDK. All modeling operations — extrude, bevel, inset, loop-cut, knife, dissolve, subdivide — operate on `HalfEdgeMesh`.

## Purpose

The `mesh` package implements a **half-edge data structure** that provides:

- O(1) adjacency queries (neighbor faces, edges, vertices)
- Explicit corner records for per-face-vertex attributes (UVs, normals, colors)
- Revision tracking for efficient viewport synchronization
- A full suite of **topology operations**: extrude, bevel, inset, loop-cut, knife cut, dissolve, collapse, bridge, fill, merge, subdivide, split, duplicate, separate, join, triangulate, triangles-to-quads
- **MeshBuilder** for programmatic mesh construction with automatic edge welding and manifold enforcement
- **MeshLocalBvh** for accelerated face-level spatial queries
- **Earcut triangulation** backend for polygon triangulation

## Key Exports

```ts
// Core mesh
import { HalfEdgeMesh } from "@modeling-kit/mesh";
// Builder
import { MeshBuilder, type AddFaceOptions, type MeshBuilderOptions } from "@modeling-kit/mesh";
// Triangulation
import { triangulatePolygon, triangulatePolygonLoops, triangulateMesh } from "@modeling-kit/mesh";
// Serialization
import { serializeMesh, deserializeMesh, cloneMesh, meshFingerprint } from "@modeling-kit/mesh";
// BVH
import { createMeshLocalBvh, MeshLocalBvh, type MeshLocalHit } from "@modeling-kit/mesh";
// Topology operations
import {
  extrudeFaces, bevelEdges, insetFaces, loopCut,
  executeKnifeCutPlan, planKnifeCuts,
  dissolveEdge, dissolveFace, dissolveVertex, collapseEdge,
  bridgeLoops, fillBoundary, mergeVertices, mergeVerticesByDistance,
  subdivideFaces, catmullClarkSubdivide,
  splitEdge, cutFace, connectVertices,
  duplicateFaces, separateFaces, joinMeshes,
  triangulateFaces, trianglesToQuads,
  reverseFaceWinding, deleteFace, addEdge, addFace, addVertex,
} from "@modeling-kit/mesh";
```

## Usage Example

```ts
import { MeshBuilder, HalfEdgeMesh } from "@modeling-kit/mesh";

// Build a mesh programmatically
const builder = new MeshBuilder({ revisionMode: "deferred" });
const v0 = builder.addVertex(0, 0, 0);
const v1 = builder.addVertex(1, 0, 0);
const v2 = builder.addVertex(1, 1, 0);
const v3 = builder.addVertex(0, 1, 0);
builder.addFace([v0, v1, v2, v3]);

const mesh: HalfEdgeMesh = builder.getMesh();

// Query adjacency
const faceVertices = mesh.getFaceVertices(mesh.faces.keys().next().value!);
const adjacentFaces = mesh.getAdjacentFaces(mesh.faces.keys().next().value!);
const boundaries = mesh.getBoundaryEdges();

// Iterate topology
for (const [faceId, face] of mesh.faces) {
  const vertices = mesh.getFaceVertices(faceId);
  console.log(`Face ${faceId}: ${vertices.length} vertices`);
}
```

```ts
import { MeshBuilder, extrudeFaces, bevelEdges } from "@modeling-kit/mesh";

const mesh = MeshBuilder.createCube(1);
const faceIds = [...mesh.faces.keys()].slice(0, 1); // first face

// Extrude a face
const extruded = extrudeFaces(mesh, { faceIds, distance: 0.5 });

// Bevel edges
const edges = [...mesh.edges.keys()].slice(0, 4);
const beveled = bevelEdges(mesh, { edgeIds: edges, segments: 3, width: 0.1 });
```

## Architecture Notes

- The half-edge mesh stores **five maps**: `vertices`, `edges`, `halfEdges`, `corners`, `faces` — all keyed by branded IDs.
- Each half-edge points to its **origin vertex**, **next** half-edge, **twin** half-edge, **parent edge**, and **parent face**.
- **Revision counters** track changes at granular levels: `topologyRevision`, `positionsRevision`, `uvRevision`, `seamRevision`, `pinRevision`, `materialsRevision`. Viewport adapters use these for incremental sync.
- `MeshBuilder` automatically **welds duplicate vertices** and enforces **manifold constraints** (by default). Use explicit vertex IDs to create non-manifold geometry.
- The `operations/` directory contains individual operation modules — each operation is a pure function taking a mesh and options, returning a result with change tracking.
- See `docs/architecture/mesh-kernel.md` for detailed topology semantics.