import type { FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { UvBounds } from "./types";

/**
 * Computes the axis-aligned UV bounding box for the specified faces or entire mesh.
 */
export function computeUvBounds(
  mesh: HalfEdgeMesh,
  faceIds?: readonly FaceId[] | undefined,
): UvBounds {
  const targets = faceIds ?? Array.from(mesh.faces.keys());
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  for (const fId of targets) {
    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner || !corner.uv) continue;
      const [u, v] = corner.uv;
      if (u < minU) minU = u;
      if (v < minV) minV = v;
      if (u > maxU) maxU = u;
      if (v > maxV) maxV = v;
    }
  }

  if (minU === Infinity) {
    return { minU: 0, minV: 0, maxU: 0, maxV: 0 };
  }

  return { minU, minV, maxU, maxV };
}

export interface TransformUvOptions {
  readonly faceIds?: readonly FaceId[] | undefined;
  readonly translate?: [u: number, v: number] | undefined;
  readonly scale?: [u: number, v: number] | undefined;
  readonly rotateAngle?: number | undefined; // radians
  readonly pivot?: [u: number, v: number] | undefined;
}

/**
 * Translates, scales, and rotates UV coordinates for target faces.
 */
export function transformUvs(mesh: HalfEdgeMesh, options: TransformUvOptions): void {
  const targets = options.faceIds ?? Array.from(mesh.faces.keys());
  const translate = options.translate ?? [0, 0];
  const scale = options.scale ?? [1, 1];
  const angle = options.rotateAngle ?? 0;
  const pivot = options.pivot ?? [0, 0];

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (const fId of targets) {
    const corners = mesh.getFaceCorners(fId);
    for (const cId of corners) {
      const corner = mesh.corners.get(cId);
      if (!corner || !corner.uv) continue;

      let [u, v] = corner.uv;

      // 1. Pivot offset
      u -= pivot[0];
      v -= pivot[1];

      // 2. Scale
      u *= scale[0];
      v *= scale[1];

      // 3. Rotate
      if (angle !== 0) {
        const ru = u * cos - v * sin;
        const rv = u * sin + v * cos;
        u = ru;
        v = rv;
      }

      // 4. Restore pivot and apply translation
      u += pivot[0] + translate[0];
      v += pivot[1] + translate[1];

      corner.uv = [u, v];
    }
  }
  mesh.bumpUvRevision();
}
