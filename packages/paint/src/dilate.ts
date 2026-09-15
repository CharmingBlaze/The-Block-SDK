import type { PixelRect } from "./types";
import type { TextureBuffer } from "./texture-buffer";

/**
 * Morphological dilation of opaque texels into transparent neighbors.
 * Used as UV-island gutter padding so bilinear filtering does not sample empty
 * pixels across seams. Iterates `radius` times; each pass copies from the
 * previous snapshot so growth is exactly one texel per pass.
 */
export function dilateSeamTexels(
  buffer: TextureBuffer,
  radius: number,
  bounds?: PixelRect,
): void {
  const steps = Math.max(0, Math.floor(radius));
  if (steps === 0) {
    return;
  }
  const width = buffer.width;
  const height = buffer.height;
  const x0 = bounds ? Math.max(0, bounds.x) : 0;
  const y0 = bounds ? Math.max(0, bounds.y) : 0;
  const x1 = bounds ? Math.min(width, bounds.x + bounds.width) : width;
  const y1 = bounds ? Math.min(height, bounds.y + bounds.height) : height;
  if (x1 <= x0 || y1 <= y0) {
    return;
  }
  const src = new Uint8ClampedArray(buffer.data);
  const dst = buffer.data;
  for (let pass = 0; pass < steps; pass += 1) {
    if (pass > 0) {
      src.set(dst);
    }
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * width + x) * 4;
        if ((src[i + 3] ?? 0) > 0) {
          continue;
        }
        const donor = opaqueNeighbor(src, width, height, x, y, x0, y0, x1, y1);
        if (donor < 0) {
          continue;
        }
        dst[i] = src[donor] ?? 0;
        dst[i + 1] = src[donor + 1] ?? 0;
        dst[i + 2] = src[donor + 2] ?? 0;
        dst[i + 3] = src[donor + 3] ?? 0;
      }
    }
  }
}

function opaqueNeighbor(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const offsets: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1 || nx < 0 || ny < 0 || nx >= width || ny >= height) {
      continue;
    }
    const i = (ny * width + nx) * 4;
    if ((src[i + 3] ?? 0) > 0) {
      return i;
    }
  }
  return -1;
}
