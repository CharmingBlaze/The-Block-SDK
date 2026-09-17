import type { PixelColor } from "./types";
import type { TextureBuffer } from "./texture-buffer";

export interface TexturePixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixelToolOptions {
  readonly color: PixelColor;
  readonly erase?: boolean;
  /** Exact square brush width in texels. A value of 1 changes one texel. */
  readonly size?: number;
  readonly mirrorX?: boolean;
}

export function writePixel(
  buffer: TextureBuffer,
  point: TexturePixelPoint,
  options: PixelToolOptions,
): void {
  const color: PixelColor = options.erase ? [0, 0, 0, 0] : options.color;
  buffer.setPixel(point.x, point.y, color);
}

export function drawPixelBrush(
  buffer: TextureBuffer,
  center: TexturePixelPoint,
  options: PixelToolOptions,
): void {
  const size = Math.max(1, Math.round(options.size ?? 1));
  const start = -Math.floor((size - 1) / 2);
  for (let dy = start; dy < start + size; dy += 1) {
    for (let dx = start; dx < start + size; dx += 1) {
      writePixel(buffer, { x: center.x + dx, y: center.y + dy }, options);
      if (options.mirrorX) {
        writePixel(buffer, { x: buffer.width - 1 - (center.x + dx), y: center.y + dy }, options);
      }
    }
  }
}

export function drawPixelLine(
  buffer: TextureBuffer,
  start: TexturePixelPoint,
  end: TexturePixelPoint,
  options: PixelToolOptions,
): void {
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const sx = start.x < end.x ? 1 : -1;
  const dy = -Math.abs(end.y - start.y);
  const sy = start.y < end.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    drawPixelBrush(buffer, { x, y }, options);
    if (x === end.x && y === end.y) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

export function drawPixelRectangle(
  buffer: TextureBuffer,
  start: TexturePixelPoint,
  end: TexturePixelPoint,
  filled: boolean,
  options: PixelToolOptions,
): void {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  if (!filled) {
    drawPixelLine(buffer, { x: minX, y: minY }, { x: maxX, y: minY }, options);
    drawPixelLine(buffer, { x: maxX, y: minY }, { x: maxX, y: maxY }, options);
    drawPixelLine(buffer, { x: maxX, y: maxY }, { x: minX, y: maxY }, options);
    drawPixelLine(buffer, { x: minX, y: maxY }, { x: minX, y: minY }, options);
    return;
  }
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      writePixel(buffer, { x, y }, options);
      if (options.mirrorX) writePixel(buffer, { x: buffer.width - 1 - x, y }, options);
    }
  }
}
