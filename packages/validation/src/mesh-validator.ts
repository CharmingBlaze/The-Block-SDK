import type { EdgeId, FaceId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MeshValidationResult, MeshIssue, MeshStatistics } from "./types";

const EPSILON = 1e-6;

export function validateMesh(mesh: HalfEdgeMesh): MeshValidationResult {
  const errors: MeshIssue[] = [];
  const warnings: MeshIssue[] = [];

  // 1. Check vertices: finiteness
  for (const [vId, v] of mesh.vertices) {
    const [x, y, z] = v.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      errors.push({
        code: "NON_FINITE_POSITION",
        message: `Vertex ${vId} contains non-finite coordinate: [${x}, ${y}, ${z}]`,
        elementIds: [vId],
        recoverable: false,
      });
    }

    if (!v.halfEdge) {
      warnings.push({
        code: "ISOLATED_VERTEX",
        message: `Vertex ${vId} is isolated with no incident edges`,
        elementIds: [vId],
        recoverable: true,
      });
    }
  }

  // 2. Check edges: zero-length & manifold integrity
  for (const [eId, edge] of mesh.edges) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) {
      errors.push({
        code: "DANGLING_HALF_EDGE",
        message: `Edge ${eId} references missing half-edge ${edge.halfEdge}`,
        elementIds: [eId],
        recoverable: false,
      });
      continue;
    }

    const vFrom = mesh.vertices.get(he.origin);
    let vTo = null;
    if (he.twin) {
      const twin = mesh.halfEdges.get(he.twin);
      if (twin) vTo = mesh.vertices.get(twin.origin);
    } else {
      // If boundary, lookup through next half-edge
      const nextHe = mesh.halfEdges.get(he.next);
      if (nextHe) vTo = mesh.vertices.get(nextHe.origin);
    }

    if (vFrom && vTo) {
      const a = vFrom.position;
      const b = vTo.position;
      if (
        Number.isFinite(a[0]) &&
        Number.isFinite(a[1]) &&
        Number.isFinite(a[2]) &&
        Number.isFinite(b[0]) &&
        Number.isFinite(b[1]) &&
        Number.isFinite(b[2])
      ) {
        const p1 = new Vector3(a[0], a[1], a[2]);
        const p2 = new Vector3(b[0], b[1], b[2]);
        if (p1.distanceTo(p2) < EPSILON) {
          errors.push({
            code: "ZERO_LENGTH_EDGE",
            message: `Edge ${eId} has zero length (< ${EPSILON}) between ${vFrom.id} and ${vTo.id}`,
            elementIds: [eId, vFrom.id, vTo.id],
            recoverable: true,
          });
        }
      }
    }

    const crease = edge.creaseWeight;
    if (crease !== undefined && (!Number.isFinite(crease) || crease < 0 || crease > 1)) {
      errors.push({
        code: "INVALID_CREASE_WEIGHT",
        message: `Edge ${eId} has invalid crease weight ${crease}; expected a finite value in [0, 1]`,
        elementIds: [eId],
        recoverable: true,
      });
    }
  }

  // 3. Check faces: degeneacy and vertex counts
  for (const [fId] of mesh.faces) {
    const vIds = mesh.getFaceVertices(fId);
    if (vIds.length < 3) {
      errors.push({
        code: "DEGENERATE_FACE",
        message: `Face ${fId} has fewer than 3 vertices (${vIds.length})`,
        elementIds: [fId, ...vIds],
        recoverable: false,
      });
    }

    // Check consecutive duplicates
    for (let i = 0; i < vIds.length; i++) {
      const curr = vIds[i]!;
      const next = vIds[(i + 1) % vIds.length]!;
      if (curr === next) {
        errors.push({
          code: "CONSECUTIVE_DUPLICATE_VERTICES",
          message: `Face ${fId} has consecutive duplicate vertex ${curr}`,
          elementIds: [fId, curr],
          recoverable: true,
        });
      }
    }
  }

  const facesByEdge = new Map<string, string[]>();
  for (const [fId] of mesh.faces) {
    for (const edgeId of mesh.getFaceEdges(fId)) {
      const list = facesByEdge.get(edgeId) ?? [];
      list.push(fId);
      facesByEdge.set(edgeId, list);
    }
  }
  for (const [edgeId, faceIds] of facesByEdge) {
    if (faceIds.length > 2) {
      errors.push({
        code: "NON_MANIFOLD_EDGE",
        message: `Edge ${edgeId} is shared by ${faceIds.length} faces`,
        elementIds: [edgeId, ...faceIds],
        recoverable: false,
      });
    }
  }

  const facesByVertex = new Map<string, string[]>();
  for (const [fId] of mesh.faces) {
    for (const vId of mesh.getFaceVertices(fId)) {
      const list = facesByVertex.get(vId) ?? [];
      list.push(fId);
      facesByVertex.set(vId, list);
    }
  }
  for (const [vId, faceIds] of facesByVertex) {
    if (countVertexFans(mesh, vId, faceIds) > 1) {
      errors.push({
        code: "NON_MANIFOLD_VERTEX",
        message: `Vertex ${vId} is shared by disjoint face fans`,
        elementIds: [vId, ...faceIds],
        recoverable: false,
      });
    }
  }

  const boundaryEdges = mesh.findBoundaryEdges();
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      continue;
    }
    const dir1 = directedFaceEdge(mesh, f1, edgeId);
    const dir2 = directedFaceEdge(mesh, f2, edgeId);
    if (dir1 && dir2 && dir1[0] === dir2[0] && dir1[1] === dir2[1]) {
      warnings.push({
        code: "INCONSISTENT_WINDING",
        message: `Faces ${f1} and ${f2} traverse edge ${edgeId} in the same direction`,
        elementIds: [edgeId, f1, f2],
        recoverable: true,
      });
    }
  }
  const statistics: MeshStatistics = {
    vertexCount: mesh.vertices.size,
    edgeCount: mesh.edges.size,
    faceCount: mesh.faces.size,
    boundaryEdgeCount: boundaryEdges.length,
    isManifold:
      errors.filter((e) => e.code === "NON_MANIFOLD_EDGE" || e.code === "NON_MANIFOLD_VERTEX")
        .length === 0,
    isClosed: boundaryEdges.length === 0 && mesh.faces.size > 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics,
  };
}

function countVertexFans(
  mesh: HalfEdgeMesh,
  vertexId: string,
  faceIds: readonly string[],
): number {
  if (faceIds.length <= 1) {
    return faceIds.length;
  }
  const selected = new Set(faceIds);
  const remaining = new Set(faceIds);
  let components = 0;
  while (remaining.size > 0) {
    const start = remaining.values().next().value as string;
    remaining.delete(start);
    components += 1;
    const queue = [start];
    while (queue.length > 0) {
      const faceId = queue.pop()!;
      const loop = mesh.getFaceVertices(faceId as never);
      const edges = mesh.getFaceEdges(faceId as never);
      for (let i = 0; i < loop.length; i += 1) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        if (a !== vertexId && b !== vertexId) {
          continue;
        }
        const [f1, f2] = mesh.getEdgeFaces(edges[i]!);
        for (const other of [f1, f2]) {
          if (other && selected.has(other) && remaining.has(other)) {
            remaining.delete(other);
            queue.push(other);
          }
        }
      }
    }
  }
  return components;
}

function directedFaceEdge(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  edgeId: EdgeId,
): readonly [string, string] | null {
  const loop = mesh.getFaceVertices(faceId);
  const edges = mesh.getFaceEdges(faceId);
  const i = edges.indexOf(edgeId);
  if (i < 0) {
    return null;
  }
  return [loop[i]!, loop[(i + 1) % loop.length]!];
}
