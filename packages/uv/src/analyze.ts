import type { FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv } from "./corners";
import { computeUvBounds } from "./transforms";
import { findUvIslands } from "./islands";

export interface UvAnalysis {
  readonly outOfBoundsCornerIds: readonly string[];
  readonly flippedFaceIds: readonly FaceId[];
  readonly overlappingIslandPairs: readonly [number, number][];
}

export function analyzeUvMesh(mesh: HalfEdgeMesh): UvAnalysis {
  const outOfBoundsCornerIds: string[] = [];
  for (const corner of mesh.corners.values()) {
    const [u, v] = getCornerUv(mesh, corner.id);
    if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || v < 0 || u > 1 || v > 1) {
      outOfBoundsCornerIds.push(corner.id);
    }
  }

  const flippedFaceIds: FaceId[] = [];
  for (const face of mesh.faces.values()) {
    if (signedUvArea(mesh, face.id) < 0) {
      flippedFaceIds.push(face.id);
    }
  }

  const islands = findUvIslands(mesh);
  const boxes = islands.map((island) => computeUvBounds(mesh, island.faceIds));
  const overlappingIslandPairs: Array<[number, number]> = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (overlaps(boxes[i]!, boxes[j]!)) {
        overlappingIslandPairs.push([i, j]);
      }
    }
  }

  return { outOfBoundsCornerIds, flippedFaceIds, overlappingIslandPairs };
}

function signedUvArea(mesh: HalfEdgeMesh, faceId: FaceId): number {
  const corners = mesh.getFaceCorners(faceId);
  let area = 0;
  const n = corners.length;
  for (let i = 0; i < n; i += 1) {
    const a = getCornerUv(mesh, corners[i]!);
    const b = getCornerUv(mesh, corners[(i + 1) % n]!);
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}

function overlaps(
  a: { minU: number; minV: number; maxU: number; maxV: number },
  b: { minU: number; minV: number; maxU: number; maxV: number },
): boolean {
  return a.minU < b.maxU && a.maxU > b.minU && a.minV < b.maxV && a.maxV > b.minV;
}
