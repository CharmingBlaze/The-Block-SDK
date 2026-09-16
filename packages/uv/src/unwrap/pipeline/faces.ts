import type { FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../errors";

export function resolveTargetFaceIds(mesh: HalfEdgeMesh, faceIds: readonly FaceId[] | undefined): FaceId[] {
  const ids = faceIds ? [...faceIds] : [...mesh.faces.keys()];
  const unique: FaceId[] = [];
  const seen = new Set<FaceId>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    if (!mesh.faces.has(id)) {
      throw new UvUnwrapError("invalid-triangulation", `Unknown face ${id}`, { faceIds: [id] });
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}
