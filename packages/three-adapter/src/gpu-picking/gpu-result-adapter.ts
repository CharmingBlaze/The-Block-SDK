import type { IdentityPickResult, PointPickDomain } from "@modeling-kit/selection";
import type { GpuPointPickResult } from "./types";

export function gpuIdentityFromHit(
  hit: GpuPointPickResult,
  domain: PointPickDomain,
): IdentityPickResult {
  return {
    kind: "identity",
    source: "gpu-id-buffer",
    domain: domain === "face" ? "face" : "object",
    objectId: hit.objectId,
    ...(hit.meshId ? { meshId: hit.meshId } : {}),
    ...(hit.faceId ? { faceId: hit.faceId } : {}),
  };
}
