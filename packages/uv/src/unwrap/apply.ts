import type { CornerId, EdgeId, FaceId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv, isCornerPinned, setCornerPinned, setCornerUvs } from "../corners";
import { edgeHasSeam, setEdgeSeam } from "../seams";
import type { AutomaticUvUnwrapResult } from "./types";

interface ChannelRollback {
  readonly uvs: readonly { readonly cornerId: CornerId; readonly uv: readonly [number, number] }[];
  readonly seams: readonly { readonly edgeId: EdgeId; readonly isSeam: boolean }[];
  readonly pins: readonly { readonly cornerId: CornerId; readonly pinned: boolean }[];
}

export function applyAutomaticUnwrapResult(mesh: HalfEdgeMesh, result: AutomaticUvUnwrapResult): void {
  const rollback = captureTargetChannel(mesh, result.targetedFaceIds, result.uvChannel);
  try {
    const updates = [...result.cornerUvs.entries()].map(([cornerId, uv]) => ({
      cornerId,
      uv: [uv[0], uv[1]] as const,
    }));
    setCornerUvs(mesh, updates, result.uvChannel);
    applySeamSet(mesh, result.targetedFaceIds, result.seamEdgeIds, result.uvChannel);
  } catch (error) {
    restoreTargetChannel(mesh, result.uvChannel, rollback);
    throw error;
  }
}

export function applySeamSet(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  seamEdgeIds: ReadonlySet<EdgeId>,
  channelId: UVChannelId,
): void {
  const seen = new Set<EdgeId>();
  for (const faceId of faceIds) {
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      if (seen.has(edgeId)) {
        continue;
      }
      seen.add(edgeId);
      setEdgeSeam(mesh, edgeId, seamEdgeIds.has(edgeId), channelId);
    }
  }
  if (seen.size > 0) {
    mesh.bumpSeamRevision();
  }
}

function captureTargetChannel(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  channelId: UVChannelId,
): ChannelRollback {
  const uvs: ChannelRollback["uvs"][number][] = [];
  const seams: ChannelRollback["seams"][number][] = [];
  const pins: ChannelRollback["pins"][number][] = [];
  const seenCorners = new Set<CornerId>();
  const seenEdges = new Set<EdgeId>();
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

function restoreTargetChannel(mesh: HalfEdgeMesh, channelId: UVChannelId, rollback: ChannelRollback): void {
  setCornerUvs(
    mesh,
    rollback.uvs.map((item) => ({ cornerId: item.cornerId, uv: [item.uv[0], item.uv[1]] as const })),
    channelId,
  );
  for (const seam of rollback.seams) {
    setEdgeSeam(mesh, seam.edgeId, seam.isSeam, channelId);
  }
  if (rollback.seams.length > 0) {
    mesh.bumpSeamRevision();
  }
  for (const pin of rollback.pins) {
    setCornerPinned(mesh, pin.cornerId, pin.pinned, channelId);
  }
}
