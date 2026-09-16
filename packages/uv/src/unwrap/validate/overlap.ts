import type { CornerId, FaceId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv } from "../../corners";
import type { UvUnwrapWarning } from "../types";

export function overlapWarnings(
  mesh: HalfEdgeMesh,
  targetedFaceIds: readonly FaceId[],
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
  channelId: UVChannelId,
): UvUnwrapWarning[] {
  const targeted = new Set(targetedFaceIds);
  const selected = boundsFromUvs(cornerUvs.values());
  const otherUvs: Array<readonly [number, number]> = [];
  for (const face of mesh.faces.values()) {
    if (targeted.has(face.id)) {
      continue;
    }
    for (const cornerId of mesh.getFaceCorners(face.id)) {
      otherUvs.push(getCornerUv(mesh, cornerId, channelId));
    }
  }
  const other = boundsFromUvs(otherUvs);
  if (!selected || !other) {
    return [];
  }
  const overlaps = selected.minU < other.maxU && selected.maxU > other.minU && selected.minV < other.maxV && selected.maxV > other.minV;
  if (!overlaps) {
    return [];
  }
  return [
    {
      code: "overlap-with-unselected",
      message: "Selected-face automatic unwrap packed into [0,1] and may overlap unselected UVs",
      faceIds: targetedFaceIds,
    },
  ];
}

interface UvBounds {
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

function boundsFromUvs(uvs: Iterable<readonly [number, number]>): UvBounds | undefined {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  let count = 0;
  for (const uv of uvs) {
    count += 1;
    minU = Math.min(minU, uv[0]);
    minV = Math.min(minV, uv[1]);
    maxU = Math.max(maxU, uv[0]);
    maxV = Math.max(maxV, uv[1]);
  }
  if (count === 0 || !Number.isFinite(minU)) {
    return undefined;
  }
  return { minU, minV, maxU, maxV };
}
