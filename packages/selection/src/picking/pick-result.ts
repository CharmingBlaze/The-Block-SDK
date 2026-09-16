import type { EdgeId, FaceId, MeshId, ObjectId, VertexId } from "@modeling-kit/core";
import type { Vec3 } from "@modeling-kit/math";

export type PointPickSource = "gpu-id-buffer" | "cpu-raycast" | "cpu-spatial" | "gpu-plus-cpu-refinement";

export type PointPickDomain = "object" | "face" | "edge" | "vertex";

export interface IdentityPickResult {
  readonly kind: "identity";
  readonly source: "gpu-id-buffer" | "cpu-raycast" | "cpu-spatial";
  readonly domain: PointPickDomain;
  readonly objectId: ObjectId;
  readonly meshId?: MeshId;
  readonly faceId?: FaceId;
  readonly vertexId?: VertexId;
  readonly edgeId?: EdgeId;
  readonly triangleIndex?: number;
}

export interface SurfacePickResult {
  readonly kind: "surface";
  readonly source: "gpu-plus-cpu-refinement" | "cpu-raycast";
  readonly domain: PointPickDomain;
  readonly objectId: ObjectId;
  readonly meshId: MeshId;
  readonly faceId: FaceId;
  readonly worldPoint: Vec3;
  readonly localPoint: Vec3;
  readonly worldNormal: Vec3;
  readonly localNormal: Vec3;
  readonly distance: number;
  readonly barycentric?: Vec3;
  readonly triangleIndex?: number;
}

export type PointPickResult = IdentityPickResult | SurfacePickResult;

export function isIdentityPick(result: PointPickResult): result is IdentityPickResult {
  return result.kind === "identity";
}

export function isSurfacePick(result: PointPickResult): result is SurfacePickResult {
  return result.kind === "surface";
}

export function isFiniteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

export function requireSurfacePick(result: PointPickResult): SurfacePickResult {
  if (result.kind !== "surface") {
    throw new TypeError("Surface point required; identity-only picks cannot be used as geometry hits");
  }
  if (
    !isFiniteVec3(result.worldPoint) ||
    !isFiniteVec3(result.localPoint) ||
    !isFiniteVec3(result.worldNormal) ||
    !isFiniteVec3(result.localNormal) ||
    !Number.isFinite(result.distance)
  ) {
    throw new RangeError("Surface pick coordinates must be finite");
  }
  return result;
}

export function pickSelectionTarget(result: PointPickResult): {
  readonly domain: PointPickDomain;
  readonly objectId: ObjectId;
  readonly elementId: string;
} {
  if (result.kind === "surface") {
    return {
      domain: result.domain === "object" ? "object" : result.domain,
      objectId: result.objectId,
      elementId: result.domain === "object" ? result.objectId : result.faceId,
    };
  }
  const elementId =
    result.domain === "object"
      ? result.objectId
      : result.domain === "vertex"
        ? (result.vertexId ?? result.objectId)
        : result.domain === "edge"
          ? (result.edgeId ?? result.objectId)
          : (result.faceId ?? result.objectId);
  return {
    domain: result.domain,
    objectId: result.objectId,
    elementId,
  };
}
