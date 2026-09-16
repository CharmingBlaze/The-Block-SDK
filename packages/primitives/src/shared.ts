import { SchemaError, type FaceId, type MeshId, type VertexId } from "@modeling-kit/core";
import { MeshBuilder, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { validateMesh, type MeshIssue } from "@modeling-kit/validation";
import type { PrimitiveFaceGroups, PrimitiveResult, PrimitiveValidationResult } from "./types";

export const QUAD_UV: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export function emptyGroups(): PrimitiveFaceGroups {
  return {
    top: [],
    bottom: [],
    front: [],
    back: [],
    sides: [],
    caps: [],
  };
}

export function positive(name: string, value: number, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${name} must be a finite number greater than 0`);
  }
}

export function integerAtLeast(name: string, value: number, min: number, errors: string[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    errors.push(`${name} must be an integer >= ${min}`);
  }
}

export function requireValid(check: PrimitiveValidationResult, label: string): void {
  if (!check.ok) {
    throw new SchemaError(`${label}: ${check.errors.join("; ")}`);
  }
}

export function createPrimitiveBuilder(meshId?: MeshId): MeshBuilder {
  return new MeshBuilder({ meshId, revisionMode: "deferred" });
}

export function addFace(
  builder: MeshBuilder,
  vertices: readonly VertexId[],
  uvs: [number, number][],
  extra?: {
    readonly normals?: readonly (readonly [number, number, number])[];
    readonly isSmooth?: boolean;
    readonly skipAreaCheck?: boolean;
  },
): FaceId {
  return builder.addFace(vertices, {
    uvs,
    ...(extra?.normals ? { normals: extra.normals.map((n) => [n[0], n[1], n[2]] as [number, number, number]) } : {}),
    ...(extra?.isSmooth !== undefined ? { isSmooth: extra.isSmooth } : {}),
    ...(extra?.skipAreaCheck ? { skipAreaCheck: true } : {}),
  });
}

export function ringPoint(radius: number, index: number, count: number, y: number): [number, number, number] {
  const theta = (2 * Math.PI * index) / count;
  return [Math.sin(theta) * radius, y, Math.cos(theta) * radius];
}

export function polarUv(index: number, count: number): [number, number] {
  const theta = (2 * Math.PI * index) / count;
  return [Math.sin(theta) * 0.5 + 0.5, Math.cos(theta) * 0.5 + 0.5];
}

export function sphericalUv(x: number, y: number, z: number): [number, number] {
  const r = Math.hypot(x, y, z) || 1;
  const u = Math.atan2(x, z) / (2 * Math.PI) + 0.5;
  const v = Math.acos(Math.min(1, Math.max(-1, y / r))) / Math.PI;
  return [u, v];
}

export function unwrapSeamUvs(uvs: [number, number][]): [number, number][] {
  if (uvs.length === 0) {
    return uvs;
  }
  const us = uvs.map((uv) => uv[0]);
  const min = Math.min(...us);
  const max = Math.max(...us);
  if (max - min <= 0.5) {
    return uvs;
  }
  return uvs.map((uv) => (uv[0] < 0.5 ? ([uv[0] + 1, uv[1]] as [number, number]) : uv));
}

export function markEdgeSeam(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): void {
  for (const edgeId of mesh.getVertexEdges(a)) {
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    if (ends[0] === b || ends[1] === b) {
      const edge = mesh.edges.get(edgeId);
      if (edge) {
        edge.isSeam = true;
      }
    }
  }
}

export function finalizePrimitive(
  type: string,
  builder: MeshBuilder,
  groups: PrimitiveFaceGroups,
): PrimitiveResult {
  const mesh = builder.getMesh();
  if (mesh.faces.size === 0) {
    throw new SchemaError(`${type} primitive produced no faces`);
  }
  const validity = validateMesh(mesh);
  if (!validity.valid) {
    throw new SchemaError(
      `${type} primitive failed validation: ${validity.errors.map((issue: MeshIssue) => issue.code).join(", ")}`,
    );
  }
  for (const [faceId] of mesh.faces) {
    const verts = mesh.getFaceVertices(faceId);
    const a = mesh.vertices.get(verts[0]!)!.position;
    const b = mesh.vertices.get(verts[1]!)!.position;
    const c = mesh.vertices.get(verts[2]!)!.position;
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(nx, ny, nz) || 1;
    const fallback: [number, number, number] = [nx / len, ny / len, nz / len];
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      const corner = mesh.corners.get(cornerId);
      if (!corner) {
        continue;
      }
      if (!corner.uv || !Number.isFinite(corner.uv[0]) || !Number.isFinite(corner.uv[1])) {
        throw new SchemaError(`${type} primitive is missing per-corner UVs`);
      }
      const normal = corner.normal;
      if (
        !normal ||
        !Number.isFinite(normal[0]) ||
        !Number.isFinite(normal[1]) ||
        !Number.isFinite(normal[2])
      ) {
        corner.normal = fallback;
      }
    }
  }
  return { type, mesh, groups };
}
