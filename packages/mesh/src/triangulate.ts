import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "./half-edge-mesh";
import { triangulatePolygon } from "./polygon-triangulation";
import { tessellateValidatedFace } from "./triangulation/fast-path";
import { unitNormalOrNull } from "./triangulation/project";
import type { Vec3 } from "./triangulation/types";
import type { TriangulatedMesh } from "./types";

export interface TriangulateMeshOptions {
  readonly signal?: AbortSignal;
}

/**
 * Decomposes general polygons into render-ready triangles.
 * Convex planar triangles/quads use a fixed split; concave n-gons use Earcut.
 * Preserves source FaceId, VertexId, and CornerId on every generated triangle.
 */
export function triangulateMesh(mesh: HalfEdgeMesh, options: TriangulateMeshOptions = {}): TriangulatedMesh {
  const expectedVerts = mesh.corners.size;
  const expectedTris = Math.max(0, mesh.corners.size - 2 * mesh.faces.size);
  const positions = new Float32Array(expectedVerts * 3);
  const normals = new Float32Array(expectedVerts * 3);
  const uvs = new Float32Array(expectedVerts * 2);
  const indices = new Uint32Array(expectedTris * 3);
  const triangleFaceIds: FaceId[] = new Array(expectedTris);
  const vertexIdMap: VertexId[] = new Array(expectedVerts);
  const cornerIdMap: CornerId[] = new Array(expectedVerts);

  let vertexCursor = 0;
  let triangleCursor = 0;
  let faceIndex = 0;
  const facePoints: Vec3[] = [];

  for (const [fId] of mesh.faces) {
    if (faceIndex % 8 === 0) {
      throwIfAborted(options.signal);
    }
    faceIndex += 1;
    const loop = mesh.collectFaceLoop(fId);
    const n = loop.vertexIds.length;
    if (n < 3) {
      continue;
    }

    facePoints.length = 0;
    for (const vId of loop.vertexIds) {
      const vertex = mesh.vertices.get(vId);
      if (vertex) {
        facePoints.push(vertex.position);
      }
    }
    if (facePoints.length < 3) {
      continue;
    }

    const triangles = tessellateValidatedFace(facePoints) ?? fallbackTriangles(facePoints);
    if (!triangles || triangles.length === 0) {
      continue;
    }

    const faceNormal = unitNormalOrNull(facePoints, 1e-12);
    if (!faceNormal) {
      continue;
    }

    const faceStartIdx = vertexCursor;
    for (let i = 0; i < n; i++) {
      const pt = facePoints[i]!;
      const corner = loop.cornerIds[i] ? mesh.corners.get(loop.cornerIds[i]!) : undefined;
      const uv = corner?.uv ?? [0, 0];
      const norm = corner?.normal ?? faceNormal;
      const base = vertexCursor * 3;
      positions[base] = pt[0];
      positions[base + 1] = pt[1];
      positions[base + 2] = pt[2];
      normals[base] = norm[0];
      normals[base + 1] = norm[1];
      normals[base + 2] = norm[2];
      const uvBase = vertexCursor * 2;
      uvs[uvBase] = uv[0];
      uvs[uvBase + 1] = uv[1];
      vertexIdMap[vertexCursor] = loop.vertexIds[i]!;
      const cornerId = loop.cornerIds[i];
      if (cornerId) {
        cornerIdMap[vertexCursor] = cornerId;
      }
      vertexCursor += 1;
    }

    for (const tri of triangles) {
      if (tri[0]! >= n || tri[1]! >= n || tri[2]! >= n) {
        continue;
      }
      const indexBase = triangleCursor * 3;
      indices[indexBase] = faceStartIdx + tri[0]!;
      indices[indexBase + 1] = faceStartIdx + tri[1]!;
      indices[indexBase + 2] = faceStartIdx + tri[2]!;
      triangleFaceIds[triangleCursor] = fId;
      triangleCursor += 1;
    }
  }

  return {
    positions: shrinkFloat(positions, vertexCursor * 3),
    normals: shrinkFloat(normals, vertexCursor * 3),
    uvs: shrinkFloat(uvs, vertexCursor * 2),
    indices: shrinkUint(indices, triangleCursor * 3),
    triangleFaceIds: triangleFaceIds.slice(0, triangleCursor),
    vertexIdMap: vertexIdMap.slice(0, vertexCursor),
    cornerIdMap: cornerIdMap.slice(0, vertexCursor),
  };
}

function fallbackTriangles(points: readonly Vec3[]): readonly (readonly [number, number, number])[] {
  const triangulation = triangulatePolygon(points, { rejectSelfIntersecting: true });
  if (triangulation.status !== "ok" || triangulation.triangles.length === 0) {
    return [];
  }
  return triangulation.triangles;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("cancelled");
  }
}

function shrinkFloat(values: Float32Array, length: number): Float32Array {
  if (length === values.length) {
    return values;
  }
  return values.subarray(0, length).slice();
}

function shrinkUint(values: Uint32Array, length: number): Uint32Array {
  if (length === values.length) {
    return values;
  }
  return values.subarray(0, length).slice();
}

export interface DerivedVertexMapping {
  readonly renderVertexToVertex: readonly VertexId[];
  readonly renderVertexToCorner: readonly CornerId[];
}

/**
 * Rewrite derived positions/normals/uvs after a position or attribute edit.
 * Tessellation connectivity is unchanged; callers must not use this after
 * a topology revision.
 */
export function writeDerivedVertexAttributes(
  mesh: HalfEdgeMesh,
  mapping: DerivedVertexMapping,
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
): void {
  const faceNormals = new Map<string, readonly [number, number, number]>();
  const count = mapping.renderVertexToVertex.length;
  for (let i = 0; i < count; i += 1) {
    const vertex = mesh.vertices.get(mapping.renderVertexToVertex[i]!);
    if (vertex) {
      const base = i * 3;
      positions[base] = vertex.position[0];
      positions[base + 1] = vertex.position[1];
      positions[base + 2] = vertex.position[2];
    }
    const cornerId = mapping.renderVertexToCorner[i];
    const corner = cornerId ? mesh.corners.get(cornerId) : undefined;
    if (corner?.uv) {
      const uvBase = i * 2;
      uvs[uvBase] = corner.uv[0];
      uvs[uvBase + 1] = corner.uv[1];
    }
    const base = i * 3;
    if (corner?.normal) {
      normals[base] = corner.normal[0];
      normals[base + 1] = corner.normal[1];
      normals[base + 2] = corner.normal[2];
      continue;
    }
    if (!corner) {
      continue;
    }
    let normal = faceNormals.get(corner.faceId);
    if (!normal) {
      const loop = mesh.collectFaceLoop(corner.faceId);
      const points: Vec3[] = [];
      for (const vertexId of loop.vertexIds) {
        const record = mesh.vertices.get(vertexId);
        if (record) {
          points.push(record.position);
        }
      }
      const computed = unitNormalOrNull(points, 1e-12);
      if (computed) {
        faceNormals.set(corner.faceId, computed);
        normal = computed;
      }
    }
    if (normal) {
      normals[base] = normal[0];
      normals[base + 1] = normal[1];
      normals[base + 2] = normal[2];
    }
  }
}
