import { Vector3 } from "@modeling-kit/math";
import { triangulatePolygon, type HalfEdgeMesh } from "@modeling-kit/mesh";

/**
 * Isolated probes for one mesh. Each function repeats the same face walk the
 * production path uses, then stops at a cheaper cutoff so we can see whether
 * topology walks, allocations, Earcut, or validation dominate.
 */
export function walkFaceLoops(mesh: HalfEdgeMesh): number {
  let corners = 0;
  for (const [faceId] of mesh.faces) {
    corners += mesh.getFaceVertices(faceId).length;
    corners += mesh.getFaceCorners(faceId).length;
  }
  return corners;
}

export function copyFaceTuples(mesh: HalfEdgeMesh): number {
  let sum = 0;
  for (const [faceId] of mesh.faces) {
    const vertexIds = mesh.getFaceVertices(faceId);
    for (const vertexId of vertexIds) {
      const vertex = mesh.vertices.get(vertexId);
      if (!vertex) {
        continue;
      }
      sum += vertex.position[0] + vertex.position[1] + vertex.position[2];
    }
  }
  return sum;
}

export function copyFaceVector3(mesh: HalfEdgeMesh): number {
  let sum = 0;
  for (const [faceId] of mesh.faces) {
    const vertexIds = mesh.getFaceVertices(faceId);
    for (const vertexId of vertexIds) {
      const vertex = mesh.vertices.get(vertexId);
      if (!vertex) {
        continue;
      }
      const point = new Vector3(vertex.position[0], vertex.position[1], vertex.position[2]);
      sum += point.x + point.y + point.z;
    }
  }
  return sum;
}

export function triangulateFaces(mesh: HalfEdgeMesh, rejectSelfIntersecting: boolean): number {
  let triangles = 0;
  for (const [faceId] of mesh.faces) {
    const vertexIds = mesh.getFaceVertices(faceId);
    if (vertexIds.length < 3) {
      continue;
    }
    const points: Array<readonly [number, number, number]> = [];
    for (const vertexId of vertexIds) {
      const vertex = mesh.vertices.get(vertexId);
      if (vertex) {
        points.push(vertex.position);
      }
    }
    const result = triangulatePolygon(points, { rejectSelfIntersecting });
    triangles += result.triangles.length;
  }
  return triangles;
}

/**
 * Blender-style fixed quad split (0,1,2) / (0,2,3) with identity triangles.
 * No predicates, no projection, no Earcut. Baseline for already-quad meshes.
 */
export function fanTessellate(mesh: HalfEdgeMesh): number {
  let triangles = 0;
  for (const [faceId] of mesh.faces) {
    const n = mesh.getFaceVertices(faceId).length;
    if (n === 3) {
      triangles += 1;
    } else if (n === 4) {
      triangles += 2;
    } else if (n > 4) {
      triangles += n - 2;
    }
  }
  return triangles;
}
