import type { PixelColor, TextureBufferData } from "./types";

export class TextureBuffer implements TextureBufferData {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
    initialData?: Uint8ClampedArray | undefined,
  ) {
    if (width <= 0 || height <= 0) {
      throw new RangeError("TextureBuffer width and height must be strictly positive");
    }
    this.data = initialData ?? new Uint8ClampedArray(width * height * 4);
  }

  static create(
    width: number,
    height: number,
    fillColor: PixelColor = [0, 0, 0, 0],
  ): TextureBuffer {
    const buf = new TextureBuffer(width, height);
    if (fillColor[0] !== 0 || fillColor[1] !== 0 || fillColor[2] !== 0 || fillColor[3] !== 0) {
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        buf.data[offset] = fillColor[0];
        buf.data[offset + 1] = fillColor[1];
        buf.data[offset + 2] = fillColor[2];
        buf.data[offset + 3] = fillColor[3];
      }
    }
    return buf;
  }

  clone(): TextureBuffer {
    const copy = new Uint8ClampedArray(this.data.length);
    copy.set(this.data);
    return new TextureBuffer(this.width, this.height, copy);
  }

  getPixel(x: number, y: number): PixelColor {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }
    const idx = (y * this.width + x) * 4;
    return [this.data[idx]!, this.data[idx + 1]!, this.data[idx + 2]!, this.data[idx + 3]!];
  }

  setPixel(x: number, y: number, color: PixelColor): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    const idx = (y * this.width + x) * 4;
    this.data[idx] = color[0];
    this.data[idx + 1] = color[1];
    this.data[idx + 2] = color[2];
    this.data[idx + 3] = color[3];
  }

  blendPixel(x: number, y: number, srcColor: PixelColor, alphaFactor = 1.0): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    const idx = (y * this.width + x) * 4;
    const dstR = this.data[idx]!;
    const dstG = this.data[idx + 1]!;
    const dstB = this.data[idx + 2]!;
    const dstA = this.data[idx + 3]! / 255;

    const srcA = (srcColor[3] / 255) * alphaFactor;
    if (srcA <= 0) return;

    // Porter-Duff source-over blending
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    const outR = Math.round((srcColor[0] * srcA + dstR * dstA * (1 - srcA)) / outA);
    const outG = Math.round((srcColor[1] * srcA + dstG * dstA * (1 - srcA)) / outA);
    const outB = Math.round((srcColor[2] * srcA + dstB * dstA * (1 - srcA)) / outA);

    this.data[idx] = outR;
    this.data[idx + 1] = outG;
    this.data[idx + 2] = outB;
    this.data[idx + 3] = Math.round(outA * 255);
  }

  floodFill(
    startX: number,
    startY: number,
    targetColor: PixelColor,
    tolerance = 0,
    maxPixels = this.width * this.height,
  ): { filled: number; truncated: boolean } {
    if (startX < 0 || startX >= this.width || startY < 0 || startY >= this.height) {
      return { filled: 0, truncated: false };
    }
    const originColor = this.getPixel(startX, startY);
    if (this.colorMatches(originColor, targetColor, 0)) {
      return { filled: 0, truncated: false };
    }

    const queue: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(this.width * this.height);
    let filled = 0;
    let truncated = false;

    while (queue.length > 0) {
      if (filled >= maxPixels) {
        truncated = true;
        break;
      }
      const [cx, cy] = queue.pop()!;
      const idx = cy * this.width + cx;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const currColor = this.getPixel(cx, cy);
      if (!this.colorMatches(currColor, originColor, tolerance)) {
        continue;
      }

      this.setPixel(cx, cy, targetColor);
      filled += 1;

      if (cx > 0 && !visited[idx - 1]) queue.push([cx - 1, cy]);
      if (cx < this.width - 1 && !visited[idx + 1]) queue.push([cx + 1, cy]);
      if (cy > 0 && !visited[idx - this.width]) queue.push([cx, cy - 1]);
      if (cy < this.height - 1 && !visited[idx + this.width]) queue.push([cx, cy + 1]);
    }
    return { filled, truncated };
  }

  private colorMatches(c1: PixelColor, c2: PixelColor, tolerance: number): boolean {
    return (
      Math.abs(c1[0] - c2[0]) <= tolerance &&
      Math.abs(c1[1] - c2[1]) <= tolerance &&
      Math.abs(c1[2] - c2[2]) <= tolerance &&
      Math.abs(c1[3] - c2[3]) <= tolerance
    );
  }
}
