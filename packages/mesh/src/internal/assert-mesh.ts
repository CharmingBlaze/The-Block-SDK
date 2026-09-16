import type { HalfEdgeMesh } from "../half-edge-mesh";
import { polygonArea } from "../polygon-triangulation";

/**
 * Strict post-operation topology check used by Catmull–Clark and bevel.
 * Failure must roll back through `runTransactionalMeshOp`.
 */
export function assertStrictMesh(mesh: HalfEdgeMesh, operation: string): void {
  for (const [vertexId, vertex] of mesh.vertices) {
    const [x, y, z] = vertex.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new RangeError(`${operation}: vertex ${vertexId} has a non-finite position`);
    }
  }

  for (const [faceId] of mesh.faces) {
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      throw new RangeError(`${operation}: face ${faceId} has fewer than 3 vertices`);
    }
    const unique = new Set(loop);
    if (unique.size < 3) {
      throw new RangeError(`${operation}: face ${faceId} does not have 3 distinct vertices`);
    }
    for (let i = 0; i < loop.length; i += 1) {
      if (loop[i] === loop[(i + 1) % loop.length]) {
        throw new RangeError(`${operation}: face ${faceId} has consecutive duplicate vertices`);
      }
    }
    const points = loop.map((id) => mesh.vertices.get(id)!.position);
    if (polygonArea(points) <= 1e-12) {
      throw new RangeError(`${operation}: face ${faceId} has zero area`);
    }
  }

  const facesByEdge = new Map<string, string[]>();
  for (const [faceId] of mesh.faces) {
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      const list = facesByEdge.get(edgeId) ?? [];
      list.push(faceId);
      facesByEdge.set(edgeId, list);
    }
  }
  for (const [edgeId, faceIds] of facesByEdge) {
    if (faceIds.length > 2) {
      throw new RangeError(`${operation}: edge ${edgeId} is non-manifold`);
    }
  }

  for (const [heId, he] of mesh.halfEdges) {
    const next = mesh.halfEdges.get(he.next);
    const prev = mesh.halfEdges.get(he.prev);
    if (!next || !prev) {
      throw new RangeError(`${operation}: half-edge ${heId} has a dangling next/prev link`);
    }
    if (next.prev !== heId || prev.next !== heId) {
      throw new RangeError(`${operation}: half-edge ${heId} is not in a closed loop`);
    }
    if (he.twin) {
      const twin = mesh.halfEdges.get(he.twin);
      if (!twin || twin.twin !== heId || twin.edgeId !== he.edgeId) {
        throw new RangeError(`${operation}: half-edge ${heId} has an asymmetric twin`);
      }
    }
  }
}
