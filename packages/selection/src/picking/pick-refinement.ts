import type { FaceId, MeshId, ObjectId } from "@modeling-kit/core";
import { Matrix4, Ray, Vector3, type Vec3 } from "@modeling-kit/math";
import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { PickBackfaceMode } from "./pick-request";
import type { SurfacePickResult } from "./pick-result";

export type FaceRefinementFailure =
  | "missing-face"
  | "singular-transform"
  | "no-intersection"
  | "zero-area-triangle";

export interface FaceRefinementInput {
  readonly objectId: ObjectId;
  readonly meshId: MeshId;
  readonly faceId: FaceId;
  readonly mesh: HalfEdgeMesh;
  readonly worldFromLocal: Matrix4;
  readonly worldRayOrigin: Vec3;
  readonly worldRayDirection: Vec3;
  readonly backfaceMode: PickBackfaceMode;
  readonly domain?: SurfacePickResult["domain"];
}

export type FaceRefinementOutcome =
  | { readonly ok: true; readonly hit: SurfacePickResult }
  | { readonly ok: false; readonly reason: FaceRefinementFailure };

/**
 * Intersect a world-space pointer ray with the canonical triangulation of one
 * identified face. Does not raycast the rest of the scene.
 */
export function refineFaceSurface(input: FaceRefinementInput): FaceRefinementOutcome {
  if (!input.mesh.faces.has(input.faceId)) {
    return { ok: false, reason: "missing-face" };
  }
  let localFromWorld: Matrix4;
  try {
    localFromWorld = input.worldFromLocal.invert();
  } catch {
    return { ok: false, reason: "singular-transform" };
  }
  const localOrigin = localFromWorld.transformPoint(input.worldRayOrigin);
  let localDirection: Vector3;
  try {
    localDirection = localFromWorld.transformDirection(input.worldRayDirection).normalize();
  } catch {
    return { ok: false, reason: "singular-transform" };
  }
  const localRay = new Ray(localOrigin, localDirection);
  const tri = triangulateMesh(input.mesh);
  let best:
    | {
        t: number;
        localPoint: Vector3;
        localNormal: Vector3;
        barycentric: Vector3;
        triangleIndex: number;
      }
    | undefined;

  for (let t = 0; t < tri.triangleFaceIds.length; t += 1) {
    if (tri.triangleFaceIds[t] !== input.faceId) {
      continue;
    }
    const i0 = tri.indices[t * 3]!;
    const i1 = tri.indices[t * 3 + 1]!;
    const i2 = tri.indices[t * 3 + 2]!;
    const a = vertexAt(tri.positions, i0);
    const b = vertexAt(tri.positions, i1);
    const c = vertexAt(tri.positions, i2);
    const hit = intersectTriangle(localRay, a, b, c, input.backfaceMode);
    if (!hit) {
      continue;
    }
    if (best && hit.t >= best.t) {
      continue;
    }
    best = { ...hit, triangleIndex: t };
  }

  if (!best) {
    return { ok: false, reason: "no-intersection" };
  }

  const worldPoint = input.worldFromLocal.transformPoint(best.localPoint);
  const worldNormal = input.worldFromLocal.transformDirection(best.localNormal);
  let unitWorld: Vector3;
  let unitLocal: Vector3;
  try {
    unitWorld = worldNormal.normalize();
    unitLocal = best.localNormal.normalize();
  } catch {
    return { ok: false, reason: "zero-area-triangle" };
  }
  const worldOrigin = Vector3.from(input.worldRayOrigin);
  return {
    ok: true,
    hit: {
      kind: "surface",
      source: "gpu-plus-cpu-refinement",
      domain: input.domain ?? "face",
      objectId: input.objectId,
      meshId: input.meshId,
      faceId: input.faceId,
      worldPoint: worldPoint.toJSON(),
      localPoint: best.localPoint.toJSON(),
      worldNormal: unitWorld.toJSON(),
      localNormal: unitLocal.toJSON(),
      distance: worldPoint.distanceTo(worldOrigin),
      barycentric: best.barycentric.toJSON(),
      triangleIndex: best.triangleIndex,
    },
  };
}

function vertexAt(positions: Float32Array, index: number): Vector3 {
  const o = index * 3;
  return new Vector3(positions[o]!, positions[o + 1]!, positions[o + 2]!);
}

function intersectTriangle(
  ray: Ray,
  a: Vector3,
  b: Vector3,
  c: Vector3,
  backfaceMode: PickBackfaceMode,
): { t: number; localPoint: Vector3; localNormal: Vector3; barycentric: Vector3 } | undefined {
  const edge1 = b.sub(a);
  const edge2 = c.sub(a);
  const pvec = ray.direction.cross(edge2);
  const det = edge1.dot(pvec);
  if (Math.abs(det) < 1e-10) {
    return undefined;
  }
  const frontFacing = det > 0;
  if (backfaceMode === "front-only" && !frontFacing) {
    return undefined;
  }
  const invDet = 1 / det;
  const tvec = ray.origin.sub(a);
  const u = tvec.dot(pvec) * invDet;
  if (u < 0 || u > 1) {
    return undefined;
  }
  const qvec = tvec.cross(edge1);
  const v = ray.direction.dot(qvec) * invDet;
  if (v < 0 || u + v > 1) {
    return undefined;
  }
  const t = edge2.dot(qvec) * invDet;
  if (t < 1e-8) {
    return undefined;
  }
  const normal = edge1.cross(edge2);
  return {
    t,
    localPoint: ray.at(t),
    localNormal: frontFacing ? normal : normal.negate(),
    barycentric: new Vector3(1 - u - v, u, v),
  };
}
