import type { CornerId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv, setCornerUv } from "./corners";
import { findUvIslands } from "./islands";

export interface PackUvsOptions {
  readonly padding?: number;
}

export function packUvs(mesh: HalfEdgeMesh, options: PackUvsOptions = {}): void {
  const padding = options.padding ?? 0.02;
  const islands = findUvIslands(mesh);
  const placed: Array<{
    corners: readonly CornerId[];
    uvs: Array<[number, number]>;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  const prepared = islands.map((island) => {
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    const uvs: Array<[number, number]> = island.cornerIds.map((id) => {
      const uv = getCornerUv(mesh, id);
      minU = Math.min(minU, uv[0]);
      minV = Math.min(minV, uv[1]);
      maxU = Math.max(maxU, uv[0]);
      maxV = Math.max(maxV, uv[1]);
      return uv;
    });
    const w = Math.max(1e-6, maxU - minU);
    const h = Math.max(1e-6, maxV - minV);
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
