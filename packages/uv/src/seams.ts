import type { EdgeId, UVChannelId } from "@modeling-kit/core";
import type { EdgeRecord, HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "./channels";

export function edgeHasSeam(
  edge: EdgeRecord,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): boolean {
  if (edge.seamChannels?.includes(channelId)) {
    return true;
  }
  return channelId === DEFAULT_UV_CHANNEL && edge.isSeam;
}

export function setEdgeSeam(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
  isSeam: boolean,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    return;
  }
  const channels = new Set(edge.seamChannels ?? []);
  if (isSeam) {
    channels.add(channelId);
  } else {
    channels.delete(channelId);
  }
  mesh.edges.set(edgeId, {
    ...edge,
    isSeam: channelId === DEFAULT_UV_CHANNEL ? isSeam : edge.isSeam,
    seamChannels: channels.size > 0 ? ([...channels] as UVChannelId[]) : undefined,
  });
}

export function setSeams(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  isSeam: boolean,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  for (const edgeId of edgeIds) {
    setEdgeSeam(mesh, edgeId, isSeam, channelId);
  }
  if (edgeIds.length > 0) {
    mesh.bumpSeamRevision();
  }
}

export function toggleSeams(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  for (const edgeId of edgeIds) {
    const edge = mesh.edges.get(edgeId);
    if (!edge) {
      continue;
    }
    setEdgeSeam(mesh, edgeId, !edgeHasSeam(edge, channelId), channelId);
  }
  if (edgeIds.length > 0) {
    mesh.bumpSeamRevision();
  }
}

export function clearAllSeams(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  setSeams(mesh, [...mesh.edges.keys()], false, channelId);
}

export function markBoundarySeams(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  setSeams(mesh, mesh.findBoundaryEdges(), true, channelId);
}
