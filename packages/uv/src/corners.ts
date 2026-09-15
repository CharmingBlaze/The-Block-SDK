import { brand, type CornerId, type UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "./channels";

export { DEFAULT_UV_CHANNEL };

export type UvVec2 = readonly [number, number];

export function setCornerUv(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
  uv: UvVec2,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  writeCornerUv(mesh, cornerId, uv, channelId);
  mesh.bumpUvRevision();
}

export function setCornerUvs(
  mesh: HalfEdgeMesh,
  updates: readonly { readonly cornerId: CornerId; readonly uv: UvVec2 }[],
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  if (updates.length === 0) {
    return;
  }
  for (const update of updates) {
    writeCornerUv(mesh, update.cornerId, update.uv, channelId);
  }
  mesh.bumpUvRevision();
}

export function getCornerUv(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): [number, number] {
  const corner = mesh.corners.get(cornerId);
  if (!corner) {
    return [0, 0];
  }
  if (channelId !== DEFAULT_UV_CHANNEL) {
    return corner.uvChannels?.[channelId] ?? [0, 0];
  }
  if (corner.uv) {
    return [corner.uv[0], corner.uv[1]];
  }
  return corner.uvChannels?.[channelId] ?? [0, 0];
}

export function isCornerPinned(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): boolean {
  const corner = mesh.corners.get(cornerId);
  return corner?.pinnedUvChannels?.includes(channelId) === true;
}

export function setCornerPinned(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
  pinned: boolean,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  const corner = mesh.corners.get(cornerId);
  if (!corner) {
    return;
  }
  const current = new Set(corner.pinnedUvChannels ?? []);
  if (pinned) {
    current.add(channelId);
  } else {
    current.delete(channelId);
  }
  mesh.corners.set(cornerId, {
    ...corner,
    pinnedUvChannels: current.size > 0 ? ([...current] as UVChannelId[]) : undefined,
  });
  mesh.bumpPinRevision();
}

export function describeCornerLoop(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
): { nextCornerId: CornerId | null; previousCornerId: CornerId | null } {
  const loop = mesh.getCornerLoop(cornerId);
  return { nextCornerId: loop.next, previousCornerId: loop.prev };
}

export function normalizeUvBounds(
  mesh: HalfEdgeMesh,
  cornerIds: readonly CornerId[],
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  if (cornerIds.length === 0) {
    return;
  }
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (const id of cornerIds) {
    const [u, v] = getCornerUv(mesh, id, channelId);
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }
  const du = Math.max(1e-8, maxU - minU);
  const dv = Math.max(1e-8, maxV - minV);
  setCornerUvs(
    mesh,
    cornerIds.map((id) => {
      const [u, v] = getCornerUv(mesh, id, channelId);
      return { cornerId: id, uv: [(u - minU) / du, (v - minV) / dv] as const };
    }),
    channelId,
  );
}

function writeCornerUv(
  mesh: HalfEdgeMesh,
  cornerId: CornerId,
  uv: UvVec2,
  channelId: UVChannelId,
): void {
  const corner = mesh.corners.get(cornerId);
  if (!corner) {
    return;
  }
  const next: [number, number] = [uv[0], uv[1]];
  const uvChannels = { ...corner.uvChannels, [channelId]: next };
  mesh.corners.set(cornerId, {
    ...corner,
    ...(channelId === DEFAULT_UV_CHANNEL ? { uv: next } : {}),
    uvChannels,
  });
}

export function copyUvChannel(
  uv: UvVec2,
): [number, number] {
  return [uv[0], uv[1]];
}

/** @internal brand helper for tests */
export function asUvChannel(id: string): UVChannelId {
  return brand(id);
}
