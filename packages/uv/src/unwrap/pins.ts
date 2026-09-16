import { brand, type CornerId, type FaceId, type UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "../channels";
import { isCornerPinned } from "../corners";
import { UvUnwrapError } from "./errors";
import type { AutomaticUvUnwrapOptions, PinnedUvPolicy } from "./types";

export function resolveUvChannel(channel?: string | UVChannelId): UVChannelId {
  return channel ? brand(channel) : DEFAULT_UV_CHANNEL;
}

export function resolvePinnedPolicy(options: AutomaticUvUnwrapOptions | undefined): PinnedUvPolicy {
  if (options?.ignorePins === true || options?.pinnedUvPolicy === "ignore-with-warning") {
    return "ignore-with-warning";
  }
  return "reject";
}

export function collectPinnedCorners(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  channelId: UVChannelId,
): CornerId[] {
  const pinned: CornerId[] = [];
  for (const faceId of faceIds) {
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      if (isCornerPinned(mesh, cornerId, channelId)) {
        pinned.push(cornerId);
      }
    }
  }
  return pinned;
}

export function assertPinsAllowed(
  pinned: readonly CornerId[],
  policy: PinnedUvPolicy,
): void {
  if (pinned.length === 0 || policy === "ignore-with-warning") {
    return;
  }
  throw new UvUnwrapError(
    "pinned-uv",
    "Automatic chart unwrap refuses to move pinned UV corners unless ignorePins is set",
    { cornerIds: pinned },
  );
}
