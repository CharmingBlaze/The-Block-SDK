import type { FaceId } from "@modeling-kit/core";
import { faceNormal, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { PrimitiveFaceGroups } from "../types";

export function groupFaces(mesh: HalfEdgeMesh): PrimitiveFaceGroups {
  const top: FaceId[] = [];
  const bottom: FaceId[] = [];
  const front: FaceId[] = [];
  const back: FaceId[] = [];
  const sides: FaceId[] = [];
  for (const [faceId] of mesh.faces) {
    const n = faceNormal(mesh, faceId);
    if (n.y > 0.7) {
      top.push(faceId);
    } else if (n.y < -0.7) {
      bottom.push(faceId);
    } else if (n.z > 0.7) {
      front.push(faceId);
    } else if (n.z < -0.7) {
      back.push(faceId);
    } else {
      sides.push(faceId);
    }
  }
  return {
    top,
    bottom,
    front,
    back,
    sides: [...sides, ...front, ...back],
    caps: [...top, ...bottom],
  };
}
