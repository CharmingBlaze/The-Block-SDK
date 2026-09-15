import { Vector3 } from "@modeling-kit/math";
import { faceNormal, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type {
  BoxProjectionOptions,
  CylindricalProjectionOptions,
  PlanarProjectionOptions,
  SphericalProjectionOptions,
} from "./types";

/**
 * Projects UV coordinates planarly along the specified axis or direction vector.
 */
export function projectPlanarUv(mesh: HalfEdgeMesh, options: PlanarProjectionOptions): void {
  const targetFaces = options.faceIds ?? Array.from(mesh.faces.keys());

  let uAxis: Vector3;
  let vAxis: Vector3;

  if (options.direction === "x") {
    uAxis = new Vector3(0, 0, 1);
    vAxis = new Vector3(0, 1, 0);
  } else if (options.direction === "y") {
    uAxis = new Vector3(1, 0, 0);
    vAxis = new Vector3(0, 0, 1);
  } else if (options.direction === "z") {
    uAxis = new Vector3(1, 0, 0);
    vAxis = new Vector3(0, 1, 0);
  } else {
    // Arbitrary normal vector
    const norm = options.direction.clone().normalize();
    const up = Math.abs(norm.y) > 0.99 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
    uAxis = norm.cross(up).normalize();
    vAxis = uAxis.cross(norm).normalize();
  }

  for (const fId of targetFaces) {
    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner) continue;
      const v = mesh.vertices.get(corner.vertexId);
      if (!v) continue;
      const pos = new Vector3(v.position[0], v.position[1], v.position[2]);
      const u = pos.dot(uAxis);
      const valV = pos.dot(vAxis);
      corner.uv = [u, valV];
    }
  }
  mesh.bumpUvRevision();
}

/**
 * Projects UVs using box (tri-planar) mapping based on dominant face normals.
 */
export function projectBoxUv(mesh: HalfEdgeMesh, options: BoxProjectionOptions = {}): void {
  const targetFaces = options.faceIds ?? Array.from(mesh.faces.keys());
  const scale = options.scale ?? 1.0;

  for (const fId of targetFaces) {
    const norm = faceNormal(mesh, fId);
    const absX = Math.abs(norm.x);
    const absY = Math.abs(norm.y);
    const absZ = Math.abs(norm.z);

    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner) continue;
      const v = mesh.vertices.get(corner.vertexId);
      if (!v) continue;
      const [x, y, z] = v.position;

      let u = 0;
      let valV = 0;

      if (absX >= absY && absX >= absZ) {
        // X dominant: map Z to U, Y to V
        u = (norm.x > 0 ? -z : z) * scale;
        valV = y * scale;
      } else if (absY >= absX && absY >= absZ) {
        // Y dominant: map X to U, Z to V
        u = x * scale;
        valV = (norm.y > 0 ? -z : z) * scale;
      } else {
        // Z dominant: map X to U, Y to V
        u = (norm.z > 0 ? x : -x) * scale;
        valV = y * scale;
      }

      corner.uv = [u, valV];
    }
  }
  mesh.bumpUvRevision();
}

/**
 * Projects UV coordinates onto an unrolled cylinder around the specified axis.
 */
export function projectCylindricalUv(
  mesh: HalfEdgeMesh,
  options: CylindricalProjectionOptions = {},
): void {
  const targetFaces = options.faceIds ?? Array.from(mesh.faces.keys());
  const axis = options.axis ?? "y";

  for (const fId of targetFaces) {
    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner) continue;
      const v = mesh.vertices.get(corner.vertexId);
      if (!v) continue;
      const [x, y, z] = v.position;

      let angle = 0;
      let height = 0;

      if (axis === "y") {
        angle = Math.atan2(z, x); // [-PI, PI]
        height = y;
      } else if (axis === "x") {
        angle = Math.atan2(z, y);
        height = x;
      } else {
        angle = Math.atan2(y, x);
        height = z;
      }

      // Map angle to [0, 1]
      const u = (angle + Math.PI) / (2 * Math.PI);
      corner.uv = [u, height];
    }
  }
  mesh.bumpUvRevision();
}

/**
 * Projects UV coordinates onto a unit sphere using equirectangular projection.
 */
export function projectSphericalUv(
  mesh: HalfEdgeMesh,
  options: SphericalProjectionOptions = {},
): void {
  const targetFaces = options.faceIds ?? Array.from(mesh.faces.keys());

  for (const fId of targetFaces) {
    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner) continue;
      const v = mesh.vertices.get(corner.vertexId);
      if (!v) continue;
      const [x, y, z] = v.position;
      const len = Math.sqrt(x * x + y * y + z * z) || 1e-6;

      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      const u = 0.5 + Math.atan2(nz, nx) / (2 * Math.PI);
      const valV = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;

      corner.uv = [u, valV];
    }
  }
  mesh.bumpUvRevision();
}
