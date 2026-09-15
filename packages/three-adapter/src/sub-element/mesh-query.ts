import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { EdgeRole } from "./types";

export function classifyEdge(mesh: HalfEdgeMesh, edgeId: EdgeId): EdgeRole {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    return "interior";
  }
  if (edge.isSeam) {
    return "seam";
  }
  const [f1, f2] = mesh.getEdgeFaces(edgeId);
  if (!f1 || !f2) {
    return "boundary";
  }
  if (edge.creaseAngle !== undefined && edge.creaseAngle > 0) {
    return "crease";
  }
  const a = mesh.faces.get(f1);
  const b = mesh.faces.get(f2);
  if (a && b && (!a.isSmooth || !b.isSmooth)) {
    return "sharp";
  }
  return "interior";
}

export function edgePositions(mesh: HalfEdgeMesh, edgeId: EdgeId): Float32Array | null {
  const verts = mesh.getEdgeVertices(edgeId);
  if (!verts) {
    return null;
  }
  const a = mesh.vertices.get(verts[0]);
  const b = mesh.vertices.get(verts[1]);
  if (!a || !b) {
    return null;
  }
  return new Float32Array([
    a.position[0],
    a.position[1],
    a.position[2],
    b.position[0],
    b.position[1],
    b.position[2],
  ]);
}

export function vertexPosition(mesh: HalfEdgeMesh, vertexId: VertexId): readonly [number, number, number] | null {
  const vertex = mesh.vertices.get(vertexId);
  if (!vertex) {
    return null;
  }
  return vertex.position;
}

export function faceOutlinePositions(mesh: HalfEdgeMesh, faceId: FaceId): number[] {
  const positions: number[] = [];
  const verts = mesh.getFaceVertices(faceId);
  for (let i = 0; i < verts.length; i += 1) {
    const a = mesh.vertices.get(verts[i]!);
    const b = mesh.vertices.get(verts[(i + 1) % verts.length]!);
    if (!a || !b) {
      continue;
    }
    positions.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
  }
  return positions;
}

export function hexToRgb(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}
