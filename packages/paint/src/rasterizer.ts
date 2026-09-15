import { TextureBuffer } from "./texture-buffer";
import type { BrushOptions, PixelColor } from "./types";

/**
 * Stamps a brush dab onto a TextureBuffer centered at (cx, cy).
 */
export function drawBrushDab(
  buffer: TextureBuffer,
  cx: number,
  cy: number,
  options: BrushOptions,
): void {
  const radius = Math.max(1, Math.round(options.size));
  const rSq = radius * radius;
  const opacity = options.opacity ?? 1.0;
  const hardness = options.hardness ?? 1.0;
  const isEraser = options.mode === "eraser";

  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(buffer.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(buffer.height - 1, Math.ceil(cy + radius));

  const eraseColor: PixelColor = [0, 0, 0, 0];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > rSq) continue;

      const dist = Math.sqrt(distSq);
      const normDist = dist / radius; // [0, 1]

      let falloff = 1.0;
      if (hardness < 1.0) {
        if (normDist > hardness) {
          falloff = 1 - (normDist - hardness) / Math.max(1e-6, 1 - hardness);
        }
      }

      const strength = opacity * falloff;
      if (strength <= 0) continue;

      if (isEraser) {
        buffer.setPixel(x, y, eraseColor);
      } else {
        buffer.blendPixel(x, y, options.color, strength);
      }
    }
  }
}

/**
 * Rasterizes a continuous brush stroke between two points using Bresenham line interpolation.
 */
export function drawBrushLine(
  buffer: TextureBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  options: BrushOptions,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Step interval: spacing = half radius
  const stepSize = Math.max(1, Math.floor(options.size * 0.5));
  const steps = Math.ceil(dist / stepSize);

  if (steps <= 1) {
    drawBrushDab(buffer, x0, y0, options);
    drawBrushDab(buffer, x1, y1, options);
    return;
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    drawBrushDab(buffer, x, y, options);
  }
}
