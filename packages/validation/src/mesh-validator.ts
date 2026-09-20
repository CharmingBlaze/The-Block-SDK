import type { EdgeId, FaceId, HalfEdgeId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MeshValidationResult, MeshIssue, MeshStatistics } from "./types";

const EPSILON = 1e-6;

export interface MeshInvariantReport {
  readonly valid: boolean;
  readonly errors: readonly MeshIssue[];
  readonly warnings: readonly MeshIssue[];
  readonly statistics: MeshStatistics;
}

export interface ValidateMeshInvariantsOptions {
  readonly geometryTolerance?: GeometryTolerance;
  readonly strictManifold?: boolean;
}

interface GeometryTolerance {
  readonly epsilon: number;
  readonly minEdgeLength: number;
  readonly minFaceArea: number;
}

export function validateMeshInvariants(
  mesh: HalfEdgeMesh,
  options?: ValidateMeshInvariantsOptions,
): MeshInvariantReport {
  const errors: MeshIssue[] = [];
  const warnings: MeshIssue[] = [];

  const tolerance = options?.geometryTolerance ?? {
    epsilon: EPSILON,
    minEdgeLength: EPSILON,
    minFaceArea: EPSILON * EPSILON,
  };
  // Note: strictManifold option is available but not currently used in validation
  // const strictManifold = options?.strictManifold ?? false;

  // 1. Check vertices: finiteness and references
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

  // 2. Check half-edge links: twin symmetry and next/prev consistency
  const seenHalfEdges = new Set<HalfEdgeId>();
  const directedEdges = new Map<string, HalfEdgeId>(); // "from_to" -> halfEdgeId
  
  for (const [heId, he] of mesh.halfEdges) {
    seenHalfEdges.add(heId);
    
    // Check vertex reference exists
    if (!mesh.vertices.has(he.origin)) {
      errors.push({
        code: "MISSING_VERTEX_REFERENCE",
        message: `Half-edge ${heId} references missing vertex ${he.origin}`,
        elementIds: [heId],
        recoverable: false,
      });
    }
    
    // Check twin link symmetry
    if (he.twin) {
      const twin = mesh.halfEdges.get(he.twin);
      if (!twin) {
        errors.push({
          code: "MISSING_TWIN_LINK",
          message: `Half-edge ${heId} references missing twin ${he.twin}`,
          elementIds: [heId],
          recoverable: false,
        });
      } else if (twin.twin !== heId) {
        errors.push({
          code: "MISSING_TWIN_LINK",
          message: `Half-edge ${heId} twin ${he.twin} does not link back`,
          elementIds: [heId, he.twin],
          recoverable: false,
        });
      }
    }
    
    // Check next/prev links
    if (he.next) {
      const next = mesh.halfEdges.get(he.next);
      if (!next) {
        errors.push({
          code: "INVALID_NEXT_PREV_LINK",
          message: `Half-edge ${heId} references missing next ${he.next}`,
          elementIds: [heId],
          recoverable: false,
        });
      } else if (next.prev !== heId) {
        errors.push({
          code: "INVALID_NEXT_PREV_LINK",
          message: `Half-edge ${heId} next ${he.next} does not link back via prev`,
          elementIds: [heId, he.next],
          recoverable: false,
        });
      }
    }
    
    if (he.prev) {
      const prev = mesh.halfEdges.get(he.prev);
      if (!prev) {
        errors.push({
          code: "INVALID_NEXT_PREV_LINK",
          message: `Half-edge ${heId} references missing prev ${he.prev}`,
          elementIds: [heId],
          recoverable: false,
        });
      } else if (prev.next !== heId) {
        errors.push({
          code: "INVALID_NEXT_PREV_LINK",
          message: `Half-edge ${heId} prev ${he.prev} does not link back via next`,
          elementIds: [heId, he.prev],
          recoverable: false,
        });
      }
    }
    
    // Record directed edge for duplicate check
    const toVertex = (() => {
      if (he.twin) {
        const twin = mesh.halfEdges.get(he.twin);
        return twin ? twin.origin : null;
      }
      if (he.next) {
        const next = mesh.halfEdges.get(he.next);
        return next ? next.origin : null;
      }
      return null;
    })();
    
    if (toVertex) {
      const key = `${he.origin}_${toVertex}`;
      const existing = directedEdges.get(key);
      if (existing && existing !== heId) {
        errors.push({
          code: "DUPLICATE_DIRECTED_EDGE",
          message: `Duplicate directed edge from ${he.origin} to ${toVertex}: ${existing} and ${heId}`,
          elementIds: [heId, existing, he.origin, toVertex],
          recoverable: false,
        });
      } else {
        directedEdges.set(key, heId);
      }
    }
  }

  // 3. Check corners
  for (const [cId, corner] of mesh.corners) {
    // Check corner references
    if (!mesh.vertices.has(corner.vertexId)) {
      errors.push({
        code: "INVALID_CORNER_REFERENCE",
        message: `Corner ${cId} references missing vertex ${corner.vertexId}`,
        elementIds: [cId],
        recoverable: false,
      });
    }
    
    if (!mesh.faces.has(corner.faceId)) {
      errors.push({
        code: "INVALID_CORNER_REFERENCE",
        message: `Corner ${cId} references missing face ${corner.faceId}`,
        elementIds: [cId],
        recoverable: false,
      });
    }
    
    // Check attribute arrays for finite values
    if (corner.uv && (!Number.isFinite(corner.uv[0]) || !Number.isFinite(corner.uv[1]))) {
      errors.push({
        code: "NON_FINITE_ATTRIBUTE_VALUE",
        message: `Corner ${cId} has non-finite UV value`,
        elementIds: [cId],
        recoverable: true,
      });
    }
    
    if (corner.normal && (!Number.isFinite(corner.normal[0]) || !Number.isFinite(corner.normal[1]) || !Number.isFinite(corner.normal[2]))) {
      errors.push({
        code: "NON_FINITE_ATTRIBUTE_VALUE",
        message: `Corner ${cId} has non-finite normal value`,
        elementIds: [cId],
        recoverable: true,
      });
    }
    
    if (corner.color && (!Number.isFinite(corner.color[0]) || !Number.isFinite(corner.color[1]) || !Number.isFinite(corner.color[2]) || !Number.isFinite(corner.color[3]))) {
      errors.push({
        code: "NON_FINITE_ATTRIBUTE_VALUE",
        message: `Corner ${cId} has non-finite color value`,
        elementIds: [cId],
        recoverable: true,
      });
    }
  }

  // 4. Check faces for orphaned corners
  for (const [fId] of mesh.faces) {
    const corners = mesh.getFaceCorners(fId);
    for (const cornerId of corners) {
      if (!mesh.corners.has(cornerId)) {
        errors.push({
          code: "ORPHANED_CORNER",
          message: `Face ${fId} references missing corner ${cornerId}`,
          elementIds: [fId, cornerId],
          recoverable: false,
        });
      }
    }
  }

  // 5. Check edges: zero-length & manifold integrity
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
        if (p1.distanceTo(p2) < tolerance.minEdgeLength) {
          errors.push({
            code: "ZERO_LENGTH_EDGE",
            message: `Edge ${eId} has zero length (< ${tolerance.minEdgeLength}) between ${vFrom.id} and ${vTo.id}`,
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

// Backward compatibility export
export function validateMesh(mesh: HalfEdgeMesh): MeshValidationResult {
  return validateMeshInvariants(mesh);
}
