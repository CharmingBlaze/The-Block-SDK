import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { triangulatePolygon, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "./types";

export interface OcclusionSample {
  readonly id: string;
  readonly domain: SelectionSnapshot["domain"];
  readonly world: { readonly x: number; readonly y: number; readonly z: number };
  readonly screen: { readonly x: number; readonly y: number };
}

export interface RayOccluder {
  (sample: OcclusionSample): boolean;
}

interface OccluderTriangle {
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly c: readonly [number, number, number];
  readonly faceId: string;
}

const OCCLUSION_T_EPSILON = 1e-4;

/**
 * Headless visibility test: a sample is occluded when a mesh triangle
 * intersects the segment from `cameraOrigin` to the sample before the sample.
 * Camera and mesh positions must be in the same space.
 */
export function createRayOccluder(
  mesh: HalfEdgeMesh,
  cameraOrigin: readonly [number, number, number],
): RayOccluder {
  const triangles = collectOccluderTriangles(mesh);
  return (sample) => {
    const ignored = ignoredFaces(mesh, sample.domain, sample.id);
    const target: readonly [number, number, number] = [sample.world.x, sample.world.y, sample.world.z];
    const dir: readonly [number, number, number] = [
      target[0] - cameraOrigin[0],
      target[1] - cameraOrigin[1],
      target[2] - cameraOrigin[2],
    ];
    for (const triangle of triangles) {
      if (ignored.has(triangle.faceId)) {
        continue;
      }
      const t = intersectRayTriangle(cameraOrigin, dir, triangle.a, triangle.b, triangle.c);
      if (t !== undefined && t > OCCLUSION_T_EPSILON && t < 1 - OCCLUSION_T_EPSILON) {
        return true;
      }
    }
    return false;
  };
}

export function collectOccluderTriangles(mesh: HalfEdgeMesh): OccluderTriangle[] {
  const triangles: OccluderTriangle[] = [];
  for (const faceId of mesh.faces.keys()) {
    const loop = mesh.getFaceVertices(faceId as FaceId);
    if (loop.length < 3) {
      continue;
    }
    const points = loop.map((vertexId) => {
      const position = mesh.vertices.get(vertexId)?.position;
      if (!position) {
        throw new RangeError(`Missing vertex ${vertexId}`);
      }
      return position;
    });
    const triangulation = triangulatePolygon(points, { rejectSelfIntersecting: false });
    const faces =
      triangulation.status === "ok" && triangulation.triangles.length > 0
        ? triangulation.triangles
        : fanTriangles(points.length);
    for (const tri of faces) {
      triangles.push({
        a: points[tri[0]]!,
        b: points[tri[1]]!,
        c: points[tri[2]]!,
        faceId,
      });
    }
  }
  return triangles;
}

function fanTriangles(count: number): Array<readonly [number, number, number]> {
  const triangles: Array<readonly [number, number, number]> = [];
  for (let i = 1; i < count - 1; i += 1) {
    triangles.push([0, i, i + 1]);
  }
  return triangles;
}

function ignoredFaces(mesh: HalfEdgeMesh, domain: SelectionSnapshot["domain"], id: string): Set<string> {
  const ignored = new Set<string>();
  if (domain === "face") {
    ignored.add(id);
    return ignored;
  }
  if (domain === "vertex") {
    for (const faceId of mesh.getVertexFaces(id as VertexId)) {
      ignored.add(faceId);
    }
    return ignored;
  }
  if (domain === "edge") {
    const [f1, f2] = mesh.getEdgeFaces(id as EdgeId);
    if (f1) {
      ignored.add(f1);
    }
    if (f2) {
      ignored.add(f2);
    }
  }
  return ignored;
}

function intersectRayTriangle(
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): number | undefined {
  const epsilon = 1e-8;
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const h = cross(dir, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < epsilon) {
    return undefined;
  }
  const inv = 1 / det;
  const s = sub(origin, a);
  const u = inv * dot(s, h);
  if (u < 0 || u > 1) {
    return undefined;
  }
  const q = cross(s, e1);
  const v = inv * dot(dir, q);
  if (v < 0 || u + v > 1) {
    return undefined;
  }
  const t = inv * dot(e2, q);
  return t > epsilon ? t : undefined;
}

function sub(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
