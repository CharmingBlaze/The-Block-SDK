import { brand, type MeshId, type ObjectId } from "@modeling-kit/core";
import { Matrix4, type Vec3 } from "@modeling-kit/math";
import { refineFaceSurface, type FaceRefinementOutcome, type PickBackfaceMode } from "@modeling-kit/selection";
import type { ModelingSession } from "@modeling-kit/commands";
import type { Object3D } from "three";

export function refineGpuFaceHit(options: {
  readonly session: ModelingSession;
  readonly object: Object3D;
  readonly objectId: ObjectId;
  readonly meshId?: MeshId;
  readonly faceId?: string;
  readonly worldRayOrigin: Vec3;
  readonly worldRayDirection: Vec3;
  readonly backfaceMode: PickBackfaceMode;
  readonly domain: "object" | "face";
}): FaceRefinementOutcome {
  const meshId = options.meshId ?? brand<string, "MeshId">(String(options.object.userData.meshId ?? ""));
  const faceId = options.faceId ? brand<string, "FaceId">(options.faceId) : undefined;
  const kernel = options.session.meshes.get(meshId);
  if (!kernel || !faceId) {
    return { ok: false, reason: "missing-face" };
  }
  options.object.updateMatrixWorld(true);
  const worldFromLocal = new Matrix4([...options.object.matrixWorld.elements]);
  return refineFaceSurface({
    objectId: options.objectId,
    meshId,
    faceId,
    mesh: kernel,
    worldFromLocal,
    worldRayOrigin: options.worldRayOrigin,
    worldRayDirection: options.worldRayDirection,
    backfaceMode: options.backfaceMode,
    domain: options.domain,
  });
}
