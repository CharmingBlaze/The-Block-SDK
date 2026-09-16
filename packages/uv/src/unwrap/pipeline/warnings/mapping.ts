import type { CornerId, FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../../errors";

export function assertAllTargetCornersMapped(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): void {
  for (const faceId of faceIds) {
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      if (!cornerUvs.has(cornerId)) {
        throw new UvUnwrapError("missing-corner-mapping", `Target corner ${cornerId} received no UV`, {
          cornerIds: [cornerId],
          faceIds: [faceId],
        });
      }
    }
  }
}
