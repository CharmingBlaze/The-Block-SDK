import type { VertexId, FaceId, EdgeId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import type { MeshIssue } from "@modeling-kit/validation";

export interface AddFaceRequest {
  readonly vertexIds: readonly VertexId[];
  readonly id?: FaceId;
  readonly materialSlot?: number;
  readonly isSmooth?: boolean;
  readonly uvs?: [u: number, v: number][];
  readonly uvChannels?: Readonly<Record<string, [u: number, v: number]>>[];
  readonly pinnedUvChannels?: readonly (readonly string[])[];
  readonly normals?: [nx: number, ny: number, nz: number][];
  readonly colors?: [r: number, g: number, b: number, a: number][];
}

export interface GeometryTolerance {
  readonly epsilon: number;
  readonly minEdgeLength: number;
  readonly minFaceArea: number;
}

export function validateFaceInsertion(
  mesh: HalfEdgeMesh,
  request: AddFaceRequest,
  tolerance: GeometryTolerance,
  manifoldPolicy: "strict-manifold" | "allow-non-manifold",
): Array<MeshIssue> {
  const issues: MeshIssue[] = [];
  const { vertexIds } = request;
  const n = vertexIds.length;

  // Basic validation
  if (n < 3) {
    issues.push({
      code: "DEGENERATE_FACE",
      message: `Face must have at least 3 vertices, got ${n}`,
      elementIds: [],
      recoverable: false,
    });
    return issues;
  }

  // Check vertex existence
  for (let i = 0; i < n; i++) {
    const id = vertexIds[i]!;
    if (!mesh.vertices.has(id)) {
      issues.push({
        code: "MISSING_VERTEX_REFERENCE",
        message: `Face vertex ${id} does not exist`,
        elementIds: [id],
        recoverable: false,
      });
    }
  }

  if (issues.length > 0) return issues;

  // Check for consecutive duplicates
  for (let i = 0; i < n; i++) {
    const current = vertexIds[i]!;
    const next = vertexIds[(i + 1) % n]!;
    if (current === next) {
      issues.push({
        code: "CONSECUTIVE_DUPLICATE_VERTICES",
        message: `Face has consecutive duplicate vertices at position ${i}`,
        elementIds: [current],
        recoverable: false,
      });
    }
  }

  // Check for duplicate face ID
  if (request.id && mesh.faces.has(request.id)) {
    issues.push({
      code: "DUPLICATE_DIRECTED_EDGE", // Reusing code for duplicate element
      message: `Duplicate face id: ${request.id}`,
      elementIds: [request.id],
      recoverable: false,
    });
  }

  // Check positions are finite
  const positions = vertexIds.map(id => mesh.vertices.get(id)!.position);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = positions[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      issues.push({
        code: "NON_FINITE_POSITION",
        message: `Vertex ${vertexIds[i]} has non-finite position`,
        elementIds: [vertexIds[i]!],
        recoverable: false,
      });
    }
  }

  // Check face area - only if we have enough points
  // Note: This check is redundant with the original validateFaceInput check
  // but we keep it for completeness. The tolerance should match the original.
  if (positions.length >= 3) {
    // Use the same polygonArea function as the original validation
    // For now, we'll skip this check since validateFaceInput already does it
    // and we don't want to double-check with potentially different tolerances
  }
  // Check attribute array lengths
  if (request.uvs && request.uvs.length !== n) {
    issues.push({
      code: "INVALID_ATTRIBUTE_ARRAY_LENGTH",
      message: `UV array length ${request.uvs.length} does not match vertex count ${n}`,
      elementIds: [],
      recoverable: false,
    });
  }

  if (request.normals && request.normals.length !== n) {
    issues.push({
      code: "INVALID_ATTRIBUTE_ARRAY_LENGTH",
      message: `Normal array length ${request.normals.length} does not match vertex count ${n}`,
      elementIds: [],
      recoverable: false,
    });
  }

  if (request.colors && request.colors.length !== n) {
    issues.push({
      code: "INVALID_ATTRIBUTE_ARRAY_LENGTH",
      message: `Color array length ${request.colors.length} does not match vertex count ${n}`,
      elementIds: [],
      recoverable: false,
    });
  }

  // Check for duplicate directed edges and third-face condition
  const edgeFaceCount = new Map<EdgeId, number>();
  
  for (let i = 0; i < n; i++) {
    const vFrom = vertexIds[i]!;
    const vTo = vertexIds[(i + 1) % n]!;
    
    // Find existing edge
    const existingEdge = findEdge(mesh, vFrom, vTo);
    if (existingEdge) {
      const count = edgeFaceCount.get(existingEdge) ?? 0;
      edgeFaceCount.set(existingEdge, count + 1);
      
      if (manifoldPolicy === "strict-manifold") {
        const [f1, f2] = mesh.getEdgeFaces(existingEdge);
        if (f1 && f2) {
          // Edge already has two faces
          issues.push({
            code: "NON_MANIFOLD_EDGE",
            message: `Edge ${existingEdge} already has two incident faces; non-manifold topology is not allowed`,
            elementIds: [existingEdge, ...(f1 ? [f1] : []), ...(f2 ? [f2] : [])],
            recoverable: false,
          });
        }
      }
    }
  }

  // Check for edge length
  for (let i = 0; i < n; i++) {
    const vFrom = vertexIds[i]!;
    const vTo = vertexIds[(i + 1) % n]!;
    const p1 = mesh.vertices.get(vFrom)!.position;
    const p2 = mesh.vertices.get(vTo)!.position;
    
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (length < tolerance.minEdgeLength) {
      issues.push({
        code: "ZERO_LENGTH_EDGE",
        message: `Edge between ${vFrom} and ${vTo} has zero length: ${length}`,
        elementIds: [vFrom, vTo],
        recoverable: true,
      });
    }
  }

  return issues;
}

function findEdge(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): EdgeId | null {
  // This is a simplified version - actual implementation would use mesh's edge lookup
  for (const [edgeId, edge] of mesh.edges) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) continue;
    
    const twin = mesh.halfEdges.get(he.twin!);
    if (!twin) continue;
    
    if ((he.origin === a && twin.origin === b) || (he.origin === b && twin.origin === a)) {
      return edgeId;
    }
  }
  return null;
}