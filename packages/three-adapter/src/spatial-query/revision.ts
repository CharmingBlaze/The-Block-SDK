import type { SpatialAabb } from "./types";

const QUANT = 1e5;

export function quantizeSpatialCoord(value: number): number {
  return Math.round(value * QUANT);
}

export function spatialPrimitivesFingerprint(primitives: readonly SpatialAabb[]): string {
  if (primitives.length === 0) {
    return "0";
  }
  const parts = primitives.map((item) => {
    return `${item.objectId}:t${item.topologyRevision ?? 0}:p${item.positionsRevision ?? 0}:r${item.revision ?? 0}:${quantizeSpatialCoord(item.min.x)},${quantizeSpatialCoord(item.min.y)},${quantizeSpatialCoord(item.min.z)},${quantizeSpatialCoord(item.max.x)},${quantizeSpatialCoord(item.max.y)},${quantizeSpatialCoord(item.max.z)}`;
  });
  parts.sort();
  return `${primitives.length}|${parts.join(";")}`;
}

export function shouldRebuildSpatialIndex(previous: string | undefined, next: string): boolean {
  return previous !== next;
}
