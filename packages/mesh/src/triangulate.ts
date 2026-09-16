import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "./half-edge-mesh";
import { triangulatePolygon } from "./polygon-triangulation";
import type { TriangulatedMesh } from "./types";

export interface TriangulateMeshOptions {
  readonly signal?: AbortSignal;
}

/**
 * Decomposes general polygons into render-ready triangles.
 * Convex faces use deterministic ear clipping; concave n-gons use Earcut.
 * Preserves source FaceId, VertexId, and CornerId on every generated triangle.
 */
export function triangulateMesh(mesh: HalfEdgeMesh, options: TriangulateMeshOptions = {}): TriangulatedMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const triangleFaceIds: FaceId[] = [];
  const vertexIdMap: VertexId[] = [];
  const cornerIdMap: CornerId[] = [];

  let vertexCursor = 0;
  let faceIndex = 0;

  for (const [fId] of mesh.faces) {
    if (faceIndex % 8 === 0) {
      throwIfAborted(options.signal);
    }
    faceIndex += 1;
    const vIds = mesh.getFaceVertices(fId);
    if (vIds.length < 3) continue;

    const facePoints: Vector3[] = [];
    for (const vId of vIds) {
      const v = mesh.vertices.get(vId);
      if (v) {
        facePoints.push(new Vector3(v.position[0], v.position[1], v.position[2]));
      }
    }
    if (facePoints.length < 3) continue;

    const tuples = facePoints.map((pt) => [pt.x, pt.y, pt.z] as const);
    const triangulation = triangulatePolygon(tuples, { rejectSelfIntersecting: true });
    if (triangulation.status !== "ok" || triangulation.triangles.length === 0) {
      continue;
    }

    const faceNormal = polygonNormal(facePoints);
    if (!faceNormal) {
      continue;
    }

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

    const n = facePoints.length;
    const faceStartIdx = vertexCursor;

    for (let i = 0; i < n; i++) {
      const pt = facePoints[i]!;
      const uv = cornerUvs[i] ?? [0, 0];
      const norm = cornerNormals[i] ?? [faceNormal.x, faceNormal.y, faceNormal.z];

      positions.push(pt.x, pt.y, pt.z);
      normals.push(norm[0], norm[1], norm[2]);
      uvs.push(uv[0], uv[1]);
      vertexIdMap.push(vIds[i]!);
      const cornerId = cIds[i];
      if (cornerId) {
        cornerIdMap.push(cornerId);
      }
      vertexCursor++;
    }

    for (const tri of triangulation.triangles) {
      if (tri[0]! >= n || tri[1]! >= n || tri[2]! >= n) {
        continue;
      }
      indices.push(faceStartIdx + tri[0], faceStartIdx + tri[1], faceStartIdx + tri[2]);
      triangleFaceIds.push(fId);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    triangleFaceIds,
    vertexIdMap,
    cornerIdMap,
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("cancelled");
  }
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
