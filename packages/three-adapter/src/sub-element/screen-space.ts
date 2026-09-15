import type { ScreenSpaceCamera } from "./types";

const DEG2RAD = Math.PI / 180;

export function clampPixelSize(pixels: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, pixels));
}

/**
 * World-space size of a marker that should occupy `pixelSize` pixels at `distance`
 * from a perspective or orthographic camera.
 */
export function worldSizeForPixels(
  camera: ScreenSpaceCamera,
  distance: number,
  pixelSize: number,
  viewportHeight: number,
): number {
  const height = Math.max(1, viewportHeight);
  const pixels = Math.max(0, pixelSize);
  if (camera.isOrthographicCamera) {
    const top = camera.top ?? 1;
    const bottom = camera.bottom ?? -1;
    const frustumHeight = Math.abs(top - bottom) / Math.max(1e-8, camera.zoom ?? 1);
    return (frustumHeight * pixels) / height;
  }
  const fov = (camera.fov ?? 50) * DEG2RAD;
  const depth = Math.max(1e-8, Math.abs(distance));
  return (2 * Math.tan(fov * 0.5) * depth * pixels) / height;
}

export function distanceAlongView(
  cameraPosition: readonly [number, number, number],
  cameraForward: readonly [number, number, number],
  worldPoint: readonly [number, number, number],
): number {
  const dx = worldPoint[0] - cameraPosition[0];
  const dy = worldPoint[1] - cameraPosition[1];
  const dz = worldPoint[2] - cameraPosition[2];
  return Math.abs(dx * cameraForward[0] + dy * cameraForward[1] + dz * cameraForward[2]);
}
