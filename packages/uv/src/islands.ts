import type { CornerId, EdgeId, FaceId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { computeUvBounds } from "./transforms";
import type { UvIsland } from "./types";
import { DEFAULT_UV_CHANNEL } from "./channels";
import { edgeHasSeam, setSeams as setChannelSeams } from "./seams";
import { buildUvTopology } from "./topology";

export interface ConnectedUvIsland {
  readonly faceIds: FaceId[];
  readonly cornerIds: CornerId[];
}

export function setSeams(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  isSeam: boolean,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): void {
  setChannelSeams(mesh, edgeIds, isSeam, channelId);
}

export function findUvIslands(
  mesh: HalfEdgeMesh,
  options: { readonly maxFaces?: number | undefined; readonly channelId?: UVChannelId } = {},
): ConnectedUvIsland[] {
  const topology = buildUvTopology(mesh, options.channelId ?? DEFAULT_UV_CHANNEL);
  const islands = [...topology.islands.values()].map((island) => ({
    faceIds: [...island.faceIds],
    cornerIds: [...island.cornerIds],
  }));
  const maxFaces = options.maxFaces;
  if (maxFaces !== undefined) {
    let count = 0;
    for (const island of islands) {
      count += island.faceIds.length;
      if (count > maxFaces) {
        throw new RangeError("UV island traversal exceeded maximum face count");
      }
    }
  }
  return islands;
}

export function extractUvIslands(mesh: HalfEdgeMesh): UvIsland[] {
  return findUvIslands(mesh).map((island) => ({
    faceIds: island.faceIds,
    bounds: computeUvBounds(mesh, island.faceIds),
  }));
}

export { edgeHasSeam };
