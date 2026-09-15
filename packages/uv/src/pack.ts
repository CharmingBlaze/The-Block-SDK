import type { CornerId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv, setCornerUv } from "./corners";
import { findUvIslands } from "./islands";

export interface PackUvsOptions {
  readonly padding?: number;
  readonly strict?: boolean;
  /** Not implemented. Providing a value throws. */
  readonly pinnedIslandIds?: readonly string[];
  /** Not implemented. Providing true throws. */
  readonly rotate?: boolean;
}

export function packUvs(mesh: HalfEdgeMesh, options: PackUvsOptions = {}): void {
  if (options.pinnedIslandIds !== undefined) {
    throw new RangeError("packUvs does not support pinned islands");
  }
  if (options.rotate === true) {
    throw new RangeError("packUvs does not support island rotation");
  }
  const padding = options.padding ?? 0.02;
  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError("packUvs padding must be a finite number >= 0");
  }
  const islands = findUvIslands(mesh);
  if (islands.length === 0) {
    if (options.strict) {
      throw new RangeError("packUvs requires at least one UV island");
    }
    return;
  }
  const placed: Array<{
    corners: readonly CornerId[];
    uvs: Array<[number, number]>;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  const prepared = islands.map((island) => {
    if (island.cornerIds.length === 0) {
      if (options.strict) {
        throw new RangeError("packUvs received an empty UV island");
      }
      return { corners: island.cornerIds, uvs: [] as Array<[number, number]>, w: 1e-6, h: 1e-6 };
    }
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    const uvs: Array<[number, number]> = island.cornerIds.map((id) => {
      const uv = getCornerUv(mesh, id);
      if (!Number.isFinite(uv[0]) || !Number.isFinite(uv[1])) {
        throw new RangeError("packUvs requires finite UV coordinates");
      }
      minU = Math.min(minU, uv[0]);
      minV = Math.min(minV, uv[1]);
      maxU = Math.max(maxU, uv[0]);
      maxV = Math.max(maxV, uv[1]);
      return uv;
    });
    const w = Math.max(1e-6, maxU - minU);
    const h = Math.max(1e-6, maxV - minV);
    if (options.strict && (!Number.isFinite(w) || !Number.isFinite(h) || w <= 1e-6 || h <= 1e-6)) {
      throw new RangeError("packUvs received a degenerate UV island");
    }
    const local = uvs.map(([u, v]) => [u - minU, v - minV] as [number, number]);
    return { corners: island.cornerIds, uvs: local, w, h };
  });

  prepared.sort((a, b) => b.h - a.h);
  let shelfY = padding;
  let shelfX = padding;
  let shelfHeight = 0;
  let maxX = padding;
  let maxY = padding;
  for (const island of prepared) {
    if (shelfX > padding && shelfX + island.w + padding > 1) {
      shelfY += shelfHeight + padding;
      shelfX = padding;
      shelfHeight = 0;
    }
    placed.push({ ...island, x: shelfX, y: shelfY });
    shelfX += island.w + padding;
    shelfHeight = Math.max(shelfHeight, island.h);
    maxX = Math.max(maxX, shelfX);
    maxY = Math.max(maxY, shelfY + island.h + padding);
  }
  const scale = 1 / Math.max(maxX, maxY, 1e-6);
  for (const island of placed) {
    for (let i = 0; i < island.corners.length; i++) {
      const local = island.uvs[i]!;
      setCornerUv(mesh, island.corners[i]!, [
        (island.x + local[0]) * scale,
        (island.y + local[1]) * scale,
      ]);
    }
  }
}
