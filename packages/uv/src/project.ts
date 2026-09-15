import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { faceNormal, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { normalizeUvBounds, setCornerUv } from "./corners";

/**
 * Canonical UVs are Cartesian on the mesh, with V increasing along the
 * projection V-axis (glTF-style V-up). Hosts that draw a top-left texture
 * editor should flip V for display. This is not Blockbench Box-UV.
 *
 * `smart` is a per-face planar heuristic (face tangent frame, then normalize).
 * It is not seam-based LSCM or ABF.
 */
export type UvProjection = "planar" | "box" | "cylindrical" | "spherical" | "smart";

export interface ProjectUvsOptions {
  readonly projection: UvProjection;
  readonly faceIds?: readonly FaceId[];
  readonly axis?: "x" | "y" | "z";
  readonly normalize?: boolean;
}

function positionOf(mesh: HalfEdgeMesh, vertexId: VertexId): Vector3 {
  const v = mesh.vertices.get(vertexId);
  if (!v) {
    throw new RangeError(`Missing vertex ${vertexId}`);
  }
  return new Vector3(v.position[0], v.position[1], v.position[2]);
}

function tangentFrame(normal: Vector3): { tangent: Vector3; bitangent: Vector3 } {
  const up = Math.abs(normal.y) < 0.9 ? Vector3.unitY : Vector3.unitZ;
  const tangent = up.cross(normal).normalize();
  const bitangent = normal.cross(tangent).normalize();
  return { tangent, bitangent };
}

function boxUv(point: Vector3, normal: Vector3): [number, number] {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) {
    return [normal.x >= 0 ? point.z : -point.z, point.y];
  }
  if (ay >= ax && ay >= az) {
    return [point.x, normal.y >= 0 ? -point.z : point.z];
  }
  return [normal.z >= 0 ? point.x : -point.x, point.y];
}

function cylindricalUv(point: Vector3, axis: "x" | "y" | "z"): [number, number] {
  if (axis === "x") {
    return [Math.atan2(point.y, point.z) / (Math.PI * 2) + 0.5, point.x];
  }
  if (axis === "z") {
    return [Math.atan2(point.x, point.y) / (Math.PI * 2) + 0.5, point.z];
  }
  return [Math.atan2(point.x, point.z) / (Math.PI * 2) + 0.5, point.y];
}

function sphericalUv(point: Vector3, origin: Vector3): [number, number] {
  const dir = point.sub(origin);
  const len = dir.length();
  if (len < 1e-8) {
    return [0.5, 0.5];
  }
  const n = dir.scale(1 / len);
  const u = Math.atan2(n.x, n.z) / (Math.PI * 2) + 0.5;
  const v = Math.acos(Math.min(1, Math.max(-1, n.y))) / Math.PI;
  return [u, v];
}

export function projectUvs(mesh: HalfEdgeMesh, options: ProjectUvsOptions): void {
  const faceIds = options.faceIds ?? [...mesh.faces.keys()];
  if (faceIds.length === 0) {
    return;
  }
  const axis = options.axis ?? "y";
  const shouldNormalize = options.normalize !== false;
  const allCorners: CornerId[] = [];

  let centroid = new Vector3(0, 0, 0);
  let count = 0;
  for (const faceId of faceIds) {
    for (const vertexId of mesh.getFaceVertices(faceId)) {
      centroid = centroid.add(positionOf(mesh, vertexId));
      count += 1;
    }
  }
  if (count > 0) {
    centroid = centroid.scale(1 / count);
  }

  let averageNormal = new Vector3(0, 0, 1);
  try {
    let acc = new Vector3(0, 0, 0);
    for (const faceId of faceIds) {
      acc = acc.add(faceNormal(mesh, faceId));
    }
    if (acc.length() > 1e-8) {
      averageNormal = acc.normalize();
    }
  } catch {
    averageNormal = new Vector3(0, 0, 1);
  }
  const planarFrame = tangentFrame(averageNormal);

  for (const faceId of faceIds) {
    const vertices = mesh.getFaceVertices(faceId);
    const corners = mesh.getFaceCorners(faceId);
    const normal = faceNormal(mesh, faceId);
    const faceFrame = tangentFrame(normal);
    const faceCorners: CornerId[] = [];
    for (let i = 0; i < corners.length; i++) {
      const cornerId = corners[i]!;
      const point = positionOf(mesh, vertices[i]!);
      let uv: [number, number];
      switch (options.projection) {
        case "box":
          uv = boxUv(point, normal);
          break;
        case "cylindrical":
          uv = cylindricalUv(point, axis);
          break;
        case "spherical":
          uv = sphericalUv(point, centroid);
          break;
        case "smart":
          uv = [
            point.sub(centroid).dot(faceFrame.tangent),
            point.sub(centroid).dot(faceFrame.bitangent),
          ];
          break;
        default:
          uv = [
            point.sub(centroid).dot(planarFrame.tangent),
            point.sub(centroid).dot(planarFrame.bitangent),
          ];
      }
      setCornerUv(mesh, cornerId, uv);
      faceCorners.push(cornerId);
      allCorners.push(cornerId);
    }
    if (options.projection === "smart" && shouldNormalize) {
      normalizeUvBounds(mesh, faceCorners);
    }
  }

  if (options.projection !== "smart" && shouldNormalize) {
    normalizeUvBounds(mesh, allCorners);
  }
}
