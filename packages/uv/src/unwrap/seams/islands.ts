import type { CornerId, EdgeId, FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { UvIslandResult } from "../types";

export function islandsFromSeams(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  seamEdgeIds: ReadonlySet<EdgeId>,
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): UvIslandResult[] {
  const remaining = new Set(faceIds);
  const islands: UvIslandResult[] = [];
  const selected = new Set(faceIds);
  while (remaining.size > 0) {
    const start = remaining.values().next().value as FaceId;
    const faces = floodIsland(mesh, start, remaining, selected, seamEdgeIds);
    islands.push({
      faceIds: faces,
      cornerIds: faces.flatMap((id) => mesh.getFaceCorners(id)),
      bounds: islandBounds(mesh, faces, cornerUvs),
    });
  }
  return islands;
}

function floodIsland(
  mesh: HalfEdgeMesh,
  start: FaceId,
  remaining: Set<FaceId>,
  selected: ReadonlySet<FaceId>,
  seamEdgeIds: ReadonlySet<EdgeId>,
): FaceId[] {
  const faces: FaceId[] = [];
  const queue = [start];
  remaining.delete(start);
  while (queue.length > 0) {
    const faceId = queue.pop()!;
    faces.push(faceId);
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      if (seamEdgeIds.has(edgeId)) {
        continue;
      }
      const [left, right] = mesh.getEdgeFaces(edgeId);
      const next = left === faceId ? right : left;
      if (!next || !selected.has(next) || !remaining.has(next)) {
        continue;
      }
      remaining.delete(next);
      queue.push(next);
    }
  }
  return faces;
}

function islandBounds(
  mesh: HalfEdgeMesh,
  faces: readonly FaceId[],
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): UvIslandResult["bounds"] {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (const faceId of faces) {
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      const uv = cornerUvs.get(cornerId);
      if (!uv) {
        continue;
      }
      minU = Math.min(minU, uv[0]);
      minV = Math.min(minV, uv[1]);
      maxU = Math.max(maxU, uv[0]);
      maxV = Math.max(maxV, uv[1]);
    }
  }
  return {
    minU: Number.isFinite(minU) ? minU : 0,
    minV: Number.isFinite(minV) ? minV : 0,
    maxU: Number.isFinite(maxU) ? maxU : 0,
    maxV: Number.isFinite(maxV) ? maxV : 0,
  };
}
