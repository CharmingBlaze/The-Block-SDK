import type { CornerId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { angle2, angle3, triangleArea2, triangleArea3 } from "./geometry";
import type { UvDistortionMetrics, UvTriangulationMapping } from "./types";

const ZERO_AREA = 1e-12;

export function computeUvDistortion(
  mesh: HalfEdgeMesh,
  mapping: UvTriangulationMapping,
  cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>,
): UvDistortionMetrics {
  let flipped = 0;
  let zeroArea = 0;
  let angleSum = 0;
  let angleMax = 0;
  let areaSum = 0;
  let areaMax = 0;
  let samples = 0;
  const areaRatios: number[] = [];

  for (let t = 0; t < mapping.triangleCornerIds.length; t += 1) {
    const corners = mapping.triangleCornerIds[t];
    if (!corners) {
      continue;
    }
    const uv0 = cornerUvs.get(corners[0]);
    const uv1 = cornerUvs.get(corners[1]);
    const uv2 = cornerUvs.get(corners[2]);
    if (!uv0 || !uv1 || !uv2) {
      continue;
    }
    const uvArea = triangleArea2(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
    if (uvArea < 0) {
      flipped += 1;
    }
    if (Math.abs(uvArea) < ZERO_AREA) {
      zeroArea += 1;
    }
    const p0 = positionOf(mesh, corners[0]);
    const p1 = positionOf(mesh, corners[1]);
    const p2 = positionOf(mesh, corners[2]);
    const geomArea = triangleArea3(p0, p1, p2);
    if (geomArea > ZERO_AREA && Math.abs(uvArea) > ZERO_AREA) {
      areaRatios.push(Math.abs(uvArea) / geomArea);
    }
    const a0 = Math.abs(angle3(p2[0], p2[1], p2[2], p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]) - angle2(uv2[0], uv2[1], uv0[0], uv0[1], uv1[0], uv1[1]));
    const a1 = Math.abs(angle3(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]) - angle2(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]));
    const a2 = Math.abs(angle3(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p0[0], p0[1], p0[2]) - angle2(uv1[0], uv1[1], uv2[0], uv2[1], uv0[0], uv0[1]));
    const mean = (a0 + a1 + a2) / 3;
    angleSum += mean;
    angleMax = Math.max(angleMax, a0, a1, a2);
    samples += 1;
  }

  const meanRatio =
    areaRatios.length > 0 ? areaRatios.reduce((sum, value) => sum + value, 0) / areaRatios.length : 1;
  for (const ratio of areaRatios) {
    const distortion = Math.abs(ratio / Math.max(meanRatio, 1e-12) - 1);
    areaSum += distortion;
    areaMax = Math.max(areaMax, distortion);
  }

  return {
    flippedTriangleCount: flipped,
    zeroAreaTriangleCount: zeroArea,
    meanAngleDistortion: samples > 0 ? angleSum / samples : 0,
    maxAngleDistortion: angleMax,
    meanAreaDistortion: areaRatios.length > 0 ? areaSum / areaRatios.length : 0,
    maxAreaDistortion: areaMax,
  };
}

function positionOf(mesh: HalfEdgeMesh, cornerId: CornerId): readonly [number, number, number] {
  const corner = mesh.corners.get(cornerId);
  const vertex = corner ? mesh.vertices.get(corner.vertexId) : undefined;
  return vertex?.position ?? [0, 0, 0];
}
