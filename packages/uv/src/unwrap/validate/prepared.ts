import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../errors";
import type { AutomaticUvUnwrapResult, UvTriangulationMapping } from "../types";

export function validatePreparedUnwrap(
  mesh: HalfEdgeMesh,
  mapping: UvTriangulationMapping,
  result: AutomaticUvUnwrapResult,
  topology: { vertices: number; faces: number; edges: number },
): void {
  if (mesh.vertices.size !== topology.vertices || mesh.faces.size !== topology.faces || mesh.edges.size !== topology.edges) {
    throw new UvUnwrapError("invalid-atlas", "Automatic chart unwrap must not change canonical topology");
  }
  const targeted = new Set(result.targetedFaceIds);
  for (const faceId of result.targetedFaceIds) {
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      const uv = result.cornerUvs.get(cornerId);
      if (!uv || !Number.isFinite(uv[0]) || !Number.isFinite(uv[1])) {
        throw new UvUnwrapError("missing-corner-mapping", `Target corner ${cornerId} is missing a finite UV`, {
          cornerIds: [cornerId],
          faceIds: [faceId],
        });
      }
    }
  }
  for (const [cornerId] of result.cornerUvs) {
    const corner = mesh.corners.get(cornerId);
    if (!corner || !targeted.has(corner.faceId)) {
      throw new UvUnwrapError("missing-corner-mapping", `UV assignment ${cornerId} is not a targeted canonical corner`, {
        cornerIds: [cornerId],
      });
    }
  }
  if (mapping.triangleFaceIds.some((faceId) => !targeted.has(faceId))) {
    throw new UvUnwrapError("missing-corner-mapping", "Triangulation mapping referenced an untargeted face");
  }
}
