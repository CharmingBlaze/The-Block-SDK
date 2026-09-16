import type { UvDistortionMetrics, UvUnwrapWarning } from "../../types";

export function distortionWarnings(metrics: UvDistortionMetrics): UvUnwrapWarning[] {
  const warnings: UvUnwrapWarning[] = [];
  if (metrics.zeroAreaTriangleCount > 0) {
    warnings.push({
      code: "zero-area-triangle",
      message: `${metrics.zeroAreaTriangleCount} zero-area UV triangles were produced`,
    });
  }
  if (metrics.flippedTriangleCount > 0) {
    warnings.push({
      code: "flipped-triangle",
      message: `${metrics.flippedTriangleCount} flipped UV triangles were produced`,
    });
  }
  return warnings;
}
