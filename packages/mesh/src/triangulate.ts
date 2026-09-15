import type { FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "./half-edge-mesh";
import type { TriangulatedMesh } from "./types";

/**
 * Decomposes general polygons into render-ready triangles.
 * Preserves source FaceId traceability on every triangle for future raycast picking.
 */
export function triangulateMesh(mesh: HalfEdgeMesh): TriangulatedMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const triangleFaceIds: FaceId[] = [];
  const vertexIdMap: VertexId[] = [];

  let vertexCursor = 0;

  for (const [fId] of mesh.faces) {
    const vIds = mesh.getFaceVertices(fId);
    if (vIds.length < 3) continue;

    // Fetch vertex coordinates
    const facePoints: Vector3[] = [];
    for (const vId of vIds) {
      const v = mesh.vertices.get(vId);
      if (v) {
        facePoints.push(new Vector3(v.position[0], v.position[1], v.position[2]));
      }
    }
    if (facePoints.length < 3) continue;

    const faceNormal = polygonNormal(facePoints);
    if (!faceNormal) {
      continue;
    }

    // Fetch corner UVs and normals if available
    const cIds = mesh.getFaceCorners(fId);
    const cornerUvs: [number, number][] = [];
    const cornerNormals: [number, number, number][] = [];
    for (const cId of cIds) {
      const corner = mesh.corners.get(cId);
      cornerUvs.push(corner?.uv ?? [0, 0]);
      if (corner?.normal) {
        cornerNormals.push(corner.normal);
      }
    }

    // Polygon triangulation (fan decomposition for convex / ear-clipping)
    const n = facePoints.length;
    const faceStartIdx = vertexCursor;

    // Push render vertices for this face (split vertices per face for clean flat shading/UVs)
    for (let i = 0; i < n; i++) {
      const pt = facePoints[i]!;
      const uv = cornerUvs[i] ?? [0, 0];
      const norm = cornerNormals[i] ?? [faceNormal.x, faceNormal.y, faceNormal.z];

      positions.push(pt.x, pt.y, pt.z);
      normals.push(norm[0], norm[1], norm[2]);
      uvs.push(uv[0], uv[1]);
      vertexIdMap.push(vIds[i]!);
      vertexCursor++;
    }

    // Triangulate face boundary indices [0, 1, 2, ..., n-1]
    if (n === 3) {
      indices.push(faceStartIdx, faceStartIdx + 1, faceStartIdx + 2);
      triangleFaceIds.push(fId);
    } else if (n === 4) {
      // Quad split into 2 triangles
      indices.push(faceStartIdx, faceStartIdx + 1, faceStartIdx + 2);
      indices.push(faceStartIdx, faceStartIdx + 2, faceStartIdx + 3);
      triangleFaceIds.push(fId, fId);
    } else {
      // General polygon fan (fallback for n-gons)
      for (let i = 1; i < n - 1; i++) {
        indices.push(faceStartIdx, faceStartIdx + i, faceStartIdx + i + 1);
        triangleFaceIds.push(fId);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    triangleFaceIds,
    vertexIdMap,
  };
}

function polygonNormal(points: readonly Vector3[]): Vector3 | null {
  let normal = new Vector3(0, 0, 0);
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    normal = normal.add(
      new Vector3(
        (current.y - next.y) * (current.z + next.z),
        (current.z - next.z) * (current.x + next.x),
        (current.x - next.x) * (current.y + next.y),
      ),
    );
  }
  const length = normal.length();
  if (length > 1e-12) {
    return normal.scale(1 / length);
  }
  const cross = points[1]!.sub(points[0]!).cross(points[2]!.sub(points[0]!));
  const crossLen = cross.length();
  if (crossLen <= 1e-12) {
    return null;
  }
  return cross.scale(1 / crossLen);
}
