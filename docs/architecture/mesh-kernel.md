# Mesh Kernel Architecture

**Package:** `@modeling-kit/mesh`  
**License posture:** Clean-room independent implementation. No GPL code. No Minecraft or game-specific constraints.

---

## 1. Overview and Design Objectives

The mesh kernel is the core geometric source of truth for all polygonal modeling operations. It is completely independent of Three.js, WebGL, WebGPU, and the DOM.

Key requirements:

1. **Stable Branded IDs:** Every topological element (vertex, edge, face, corner/loop) possesses a unique, immutable branded identifier (`VertexId`, `EdgeId`, `FaceId`, `CornerId`). Array offsets and buffer indices are never treated as persistent topology IDs.
2. **General Polygonal Support:** First-class support for triangles, quads, and planar/non-planar n-gons. Cuboids are supported as general 6-face polygonal primitives, not game-specific voxel blocks.
3. **Rigorous Adjacency:** Constant-time and linear-time topological queries for vertex rings, edge fans, face boundaries, edge loops, and edge rings.
4. **Deterministic Validation:** Structural validation detecting non-manifold edges, boundary edges, degeneracies, unreferenced vertices, self-intersections, and winding inconsistencies.
5. **Exact Undoability:** Pure, functional or transaction-reversable geometric mutations.
6. **Decoupled Render Derivation:** Seamless export to triangulated GPU render buffers (`THREE.BufferGeometry` via `@modeling-kit/three-adapter`) while maintaining full traceability back to source canonical IDs.

---

## 2. Topological Data Structure

To balance rapid adjacency traversal with clean serialization and undo snapshots, `@modeling-kit/mesh` implements a **Face-Edge-Corner / Radial Half-Edge hybrid topology**:

```
        Vertex (Position, Sharpness)
          ▲
          │ references
        Corner / Loop (UV, Normal, Color) ── references ──► Face (MaterialSlot, Flags)
          ▲                                                    ▲
          │                                                    │
        HalfEdge (Origin, Twin, Next, Prev, EdgeRef, FaceRef) ─┘
          │
          ▼ references
        Edge (EdgeId, Sharpness, Seam)
```

### 2.1 Core Entities and Branded Identifiers

```ts
import { Brand } from "@modeling-kit/core";

export type MeshId = Brand<string, "MeshId">;
export type VertexId = Brand<string, "VertexId">;
export type EdgeId = Brand<string, "EdgeId">;
export type HalfEdgeId = Brand<string, "HalfEdgeId">;
export type FaceId = Brand<string, "FaceId">;
export type CornerId = Brand<string, "CornerId">;

export interface VertexRecord {
  readonly id: VertexId;
  readonly position: [x: number, y: number, z: number];
  /** Arbitrary outward half-edge originating at this vertex */
  readonly halfEdge: HalfEdgeId | null;
}

export interface EdgeRecord {
  readonly id: EdgeId;
  readonly halfEdge: HalfEdgeId;
  readonly isSeam: boolean;
  readonly creaseAngle?: number;
  readonly creaseWeight?: number; // Catmull–Clark, 0 = smooth, 1 = sharp
}

export interface HalfEdgeRecord {
  readonly id: HalfEdgeId;
  readonly edgeId: EdgeId;
  readonly origin: VertexId;
  readonly twin: HalfEdgeId | null;
  readonly next: HalfEdgeId;
  readonly prev: HalfEdgeId;
  readonly face: FaceId | null;
  readonly corner: CornerId | null;
}

export interface CornerRecord {
  readonly id: CornerId;
  readonly vertexId: VertexId;
  readonly faceId: FaceId;
  readonly uv?: [u: number, v: number];
  readonly normal?: [nx: number, ny: number, nz: number];
  readonly color?: [r: number, g: number, b: number, a: number];
}

export interface FaceRecord {
  readonly id: FaceId;
  /** Root half-edge defining the counter-clockwise boundary */
  readonly halfEdge: HalfEdgeId;
  readonly materialSlot: number;
  readonly isSmooth: boolean;
}
```

### 2.2 Canonical Mesh Container

```ts
export interface MeshKernelData {
  readonly id: MeshId;
  readonly vertices: Map<VertexId, VertexRecord>;
  readonly edges: Map<EdgeId, EdgeRecord>;
  readonly halfEdges: Map<HalfEdgeId, HalfEdgeRecord>;
  readonly corners: Map<CornerId, CornerRecord>;
  readonly faces: Map<FaceId, FaceRecord>;
  readonly revision: number;
}
```

---

## 3. Required Adjacency & Traversal Queries

The kernel exposes high-performance topological queries implemented over half-edges:

| Query Method                | Return Type                   | Description                                                |
| --------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `getVertexEdges(vId)`       | `readonly EdgeId[]`           | All edges incident to the vertex                           |
| `getVertexFaces(vId)`       | `readonly FaceId[]`           | All faces sharing the vertex                               |
| `getEdgeFaces(eId)`         | `readonly [FaceId?, FaceId?]` | Faces incident to edge (1 for boundary, 2 for manifold)    |
| `getFaceEdges(fId)`         | `readonly EdgeId[]`           | Ordered boundary edges in CCW order                        |
| `getFaceVertices(fId)`      | `readonly VertexId[]`         | Ordered vertices forming the polygon boundary              |
| `getFaceCorners(fId)`       | `readonly CornerId[]`         | Ordered per-corner UV/normal attributes                    |
| `getAdjacentFaces(fId)`     | `readonly FaceId[]`           | Neighboring faces sharing at least one edge                |
| `findBoundaryEdges()`       | `readonly EdgeId[]`           | All edges with no twin half-edge (or `twin.face === null`) |
| `findConnectedComponents()` | `readonly MeshComponent[]`    | Partitioned vertex/face islands                            |
| `findEdgeLoops(eId)`        | `readonly EdgeId[]`           | Quad-topology forward/backward edge loop traversal         |
| `findEdgeRings(eId)`        | `readonly EdgeId[]`           | Quad-topology parallel edge ring traversal                 |

---

## 4. Geometric Invariants & Validation

The mesh kernel strictly validates data integrity using deterministic rules.

```ts
export interface MeshValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MeshIssue[];
  readonly warnings: readonly MeshIssue[];
  readonly statistics: MeshStatistics;
}

export interface MeshIssue {
  readonly code: MeshIssueCode;
  readonly message: string;
  readonly elementIds: readonly (VertexId | EdgeId | FaceId)[];
  readonly recoverable: boolean;
}
```

### 4.1 Invariants Enforced

1. **Edge-Vertex Validity:** Every edge references two distinct existing vertices. Zero-length edges (where distance < $\epsilon$) are detected and rejected.
2. **Boundary Ordering:** Every face forms a closed, non-self-intersecting planar or quasi-planar loop of $\ge 3$ vertices. Consecutive duplicate vertices are invalid.
3. **Manifold Checks:** An edge cannot belong to more than 2 faces. Non-manifold edges and non-manifold vertex pinch points are flagged.
4. **Winding Consistency:** Adjacent coplanar or shared-edge faces must have opposing half-edge directions along their shared edge.
5. **No Dangling References:** Every corner references a valid vertex and face. No half-edge references deleted elements.
6. **Numerical Hygiene:** Positions and normals must never contain `NaN` or `Infinity`.

---

## 5. Render Triangulation Pipeline

Renderers (such as Three.js) require triangulated index buffers. The kernel provides an independent triangulation interface:

1. **Polygon Decomposition:**
   - Triangles ($\text{degree} = 3$): Trivial passthrough.
   - Convex Quads ($\text{degree} = 4$): Minimal diagonal split minimizing maximum interior angle.
   - N-gons ($\text{degree} > 4$): Ear-clipping triangulation with fallback to monotone polygon partitioning.
2. **Attribute Seam Splitting:**
   - Canonical topology stores positions per-vertex and UVs/normals per-corner.
   - If two faces share a vertex but have different UVs or normals (sharp edge), the render adapter generates distinct render vertices.
3. **Traceability Map:**
   - Every rendered triangle index maps directly back to its canonical `FaceId` and constituent `VertexId`s.
   - Enables constant-time CPU raycast picking back to canonical document elements.

---

## 6. Serialization & Determinism

- Serialized as plain JSON (see [document-model.md](./document-model.md)).
- Maps are serialized into sorted ID arrays to guarantee byte-for-byte deterministic hashing.
- Zero cyclic runtime object graphs in serialized output.
