import { brand, type UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { setCornerPinned, setCornerUvs, setEdgeSeam } from "@modeling-kit/uv";
import type { UvChannelEditPatch } from "./params";

export function applyUvChannelEdit(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId,
  patch: UvChannelEditPatch,
): void {
  setCornerUvs(
    mesh,
    patch.uvs.map((item) => ({ cornerId: item.cornerId, uv: [item.uv[0], item.uv[1]] as const })),
    channelId,
  );
  for (const seam of patch.seams) {
    setEdgeSeam(mesh, seam.edgeId, seam.isSeam, channelId);
  }
  if (patch.seams.length > 0) {
    mesh.bumpSeamRevision();
  }
  for (const pin of patch.pins) {
    setCornerPinned(mesh, pin.cornerId, pin.pinned, channelId);
  }
}

export function channelIdFromName(name: string): UVChannelId {
  return brand(name);
}
