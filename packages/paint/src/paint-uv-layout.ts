import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { analyzeUvMesh, getCornerUv } from "@modeling-kit/uv";

export interface PaintUvLayoutAnalysis {
  readonly ready: boolean;
  readonly missingCornerCount: number;
  readonly outOfBoundsCornerCount: number;
  readonly overlappingIslandCount: number;
  readonly overlappingFaceCount: number;
}

/**
 * Validate that a mesh can be painted without strokes repeating on unrelated
 * faces. Hosts can use this before creating a paint texture, then run their
 * undoable unwrap/pack commands when `ready` is false.
 */
export function analyzePaintUvLayout(mesh: HalfEdgeMesh): PaintUvLayoutAnalysis {
  let missingCornerCount = 0;
  for (const corner of mesh.corners.values()) {
    if (!corner.uv) missingCornerCount += 1;
  }
  const analysis = analyzeUvMesh(mesh);
  const outOfBoundsCornerCount = analysis.outOfBoundsCornerIds.length;
  const overlappingIslandCount = analysis.overlappingIslandPairs.length;
  const faceBounds = [...mesh.faces.keys()].map((faceId) => {
    const uvs = mesh.getFaceCorners(faceId).map((cornerId) => getCornerUv(mesh, cornerId));
    return {
      minU: Math.min(...uvs.map((uv) => uv[0])),
      minV: Math.min(...uvs.map((uv) => uv[1])),
      maxU: Math.max(...uvs.map((uv) => uv[0])),
      maxV: Math.max(...uvs.map((uv) => uv[1])),
    };
  });
  let overlappingFaceCount = 0;
  for (let i = 0; i < faceBounds.length; i += 1) {
    for (let j = i + 1; j < faceBounds.length; j += 1) {
      const a = faceBounds[i]!;
      const b = faceBounds[j]!;
      if (a.minU < b.maxU && a.maxU > b.minU && a.minV < b.maxV && a.maxV > b.minV) {
        overlappingFaceCount += 1;
      }
    }
  }
  return {
    ready:
      missingCornerCount === 0 &&
      outOfBoundsCornerCount === 0 &&
      overlappingIslandCount === 0 &&
      overlappingFaceCount === 0,
    missingCornerCount,
    outOfBoundsCornerCount,
    overlappingIslandCount,
    overlappingFaceCount,
  };
}
