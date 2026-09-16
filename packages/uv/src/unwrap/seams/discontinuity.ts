import { UV_SEAM_TOLERANCE } from "../constants";

export function uvsDiscontinuous(
  a: readonly [number, number],
  b: readonly [number, number],
  tolerance = UV_SEAM_TOLERANCE,
): boolean {
  return Math.abs(a[0] - b[0]) > tolerance || Math.abs(a[1] - b[1]) > tolerance;
}
