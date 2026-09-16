import type { FaceId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { edgeHasSeam, getCornerUv, isCornerPinned } from "@modeling-kit/uv";
import type { CornerPinPatch, CornerUvPatch, EdgeSeamPatch, UvChannelEditPatch } from "./params";

export function snapshotUvChannelEdit(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  channelId: UVChannelId,
): UvChannelEditPatch {
  const uvs: CornerUvPatch[] = [];
  const pins: CornerPinPatch[] = [];
  const seenCorners = new Set<string>();
  const seams: EdgeSeamPatch[] = [];
  const seenEdges = new Set<string>();
  for (const faceId of faceIds) {
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      if (seenCorners.has(cornerId)) {
        continue;
      }
      seenCorners.add(cornerId);
      uvs.push({ cornerId, uv: getCornerUv(mesh, cornerId, channelId) });
      pins.push({ cornerId, pinned: isCornerPinned(mesh, cornerId, channelId) });
    }
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      if (seenEdges.has(edgeId)) {
        continue;
      }
      seenEdges.add(edgeId);
      const edge = mesh.edges.get(edgeId);
      seams.push({ edgeId, isSeam: edge ? edgeHasSeam(edge, channelId) : false });
    }
  }
  return { uvs, seams, pins };
}
