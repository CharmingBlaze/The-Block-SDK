import { OperationLifecycleMachine, type StrokeId, brand } from "@modeling-kit/core";
import { TextureBuffer } from "./texture-buffer";
import { drawBrushDab, drawBrushLine } from "./rasterizer";
import { dilateSeamTexels } from "./dilate";
import type { BrushOptions } from "./types";

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextureTilePatch {
  readonly tileKey: string;
  readonly bounds: PixelRect;
  readonly before: Uint8ClampedArray;
  readonly after: Uint8ClampedArray;
}

export const PAINT_TILE_SIZE = 64;

export class PaintEngine {
  readonly lifecycle = new OperationLifecycleMachine();
  readonly id: StrokeId;
  private readonly originals = new Map<string, Uint8ClampedArray>();
  private dirty: PixelRect | null = null;
  private baseline: Uint8ClampedArray | null = null;
  disposed = false;

  constructor(
    readonly buffer: TextureBuffer,
    id: StrokeId = brand(`stroke-${Math.random().toString(36).slice(2)}`),
  ) {
    this.id = id;
  }

  get state(): string {
    return this.lifecycle.state;
  }

  get active(): boolean {
    return this.lifecycle.state === "beginning" || this.lifecycle.state === "active";
  }

  begin(): void {
    this.assertAlive();
    if (this.active) {
      this.cancel();
    }
    this.lifecycle.recycle();
    this.lifecycle.transition("beginning");
    this.originals.clear();
    this.dirty = null;
    this.baseline = new Uint8ClampedArray(this.buffer.data);
    this.lifecycle.transition("active");
  }

  dab(x: number, y: number, options: BrushOptions): void {
    this.assertActive();
    this.captureTiles(x, y, options.size);
    drawBrushDab(this.buffer, x, y, options);
    this.expandDirty(x, y, options.size);
  }

  strokeTo(x0: number, y0: number, x1: number, y1: number, options: BrushOptions): void {
    this.assertActive();
    this.captureTiles(x0, y0, options.size);
    this.captureTiles(x1, y1, options.size);
    drawBrushLine(this.buffer, x0, y0, x1, y1, options);
    this.expandDirty(x0, y0, options.size);
    this.expandDirty(x1, y1, options.size);
  }

  dilateSeams(radius: number): void {
    this.assertActive();
    const pad = Math.max(0, Math.ceil(radius));
    if (pad === 0 || !this.dirty) {
      return;
    }
    const expanded: PixelRect = {
      x: Math.max(0, this.dirty.x - pad),
      y: Math.max(0, this.dirty.y - pad),
      width: Math.min(this.buffer.width, this.dirty.x + this.dirty.width + pad) - Math.max(0, this.dirty.x - pad),
      height: Math.min(this.buffer.height, this.dirty.y + this.dirty.height + pad) - Math.max(0, this.dirty.y - pad),
    };
    this.captureRect(expanded);
    dilateSeamTexels(this.buffer, pad, expanded);
    this.dirty = expanded;
  }

  commit(): { patches: TextureTilePatch[]; unchanged: boolean } {
    this.assertAlive();
    if (!this.active) {
      throw new Error("PaintEngine.commit requires an active stroke");
    }
    this.hydrateOriginalsFromBaseline();
    const patches = collectPatchesFromOriginals(
      this.originals,
      this.buffer.data,
      this.buffer.width,
      this.buffer.height,
    );
    if (patches.length === 0) {
      this.cancel();
      return { patches: [], unchanged: true };
    }
    this.lifecycle.transition("committing");
    this.originals.clear();
    this.dirty = null;
    this.baseline = null;
    this.lifecycle.transition("completed");
    this.lifecycle.recycle();
    return { patches, unchanged: false };
  }

  cancel(): void {
    if (this.disposed) {
      return;
    }
    if (!this.active && this.lifecycle.state !== "committing") {
      this.lifecycle.recycle();
      return;
    }
    this.lifecycle.transition("cancelling");
    if (this.baseline) {
      this.buffer.data.set(this.baseline);
    } else {
      restoreOriginals(this.buffer.data, this.buffer.width, this.buffer.height, this.originals);
    }
    this.originals.clear();
    this.dirty = null;
    this.baseline = null;
    this.lifecycle.transition("cancelled");
    this.lifecycle.recycle();
  }

  fail(): void {
    if (this.baseline) {
      this.buffer.data.set(this.baseline);
    } else {
      restoreOriginals(this.buffer.data, this.buffer.width, this.buffer.height, this.originals);
    }
    this.originals.clear();
    this.dirty = null;
    this.baseline = null;
    this.lifecycle.fail();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.active) {
      this.cancel();
    }
    this.disposed = true;
    this.originals.clear();
    this.dirty = null;
    this.baseline = null;
  }

  private hydrateOriginalsFromBaseline(): void {
    if (!this.baseline || this.originals.size > 0) {
      return;
    }
    const width = this.buffer.width;
    const height = this.buffer.height;
    const before = this.baseline;
    const after = this.buffer.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (
          before[i] !== after[i] ||
          before[i + 1] !== after[i + 1] ||
          before[i + 2] !== after[i + 2] ||
          before[i + 3] !== after[i + 3]
        ) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      return;
    }
    const tx0 = Math.floor(minX / PAINT_TILE_SIZE);
    const ty0 = Math.floor(minY / PAINT_TILE_SIZE);
    const tx1 = Math.floor(maxX / PAINT_TILE_SIZE);
    const ty1 = Math.floor(maxY / PAINT_TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        this.originals.set(`${tx},${ty}`, copyTile(before, width, height, tx, ty));
      }
    }
  }

  private captureTiles(x: number, y: number, radius: number): void {
    const pad = Math.ceil(Math.max(1, radius)) + 1;
    const minX = Math.max(0, Math.floor(x - pad));
    const minY = Math.max(0, Math.floor(y - pad));
    const maxX = Math.min(this.buffer.width, Math.ceil(x + pad));
    const maxY = Math.min(this.buffer.height, Math.ceil(y + pad));
    this.captureRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  private captureRect(region: PixelRect): void {
    if (region.width <= 0 || region.height <= 0) {
      return;
    }
    const tx0 = Math.floor(region.x / PAINT_TILE_SIZE);
    const ty0 = Math.floor(region.y / PAINT_TILE_SIZE);
    const tx1 = Math.floor((region.x + Math.max(0, region.width - 1)) / PAINT_TILE_SIZE);
    const ty1 = Math.floor((region.y + Math.max(0, region.height - 1)) / PAINT_TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        const key = `${tx},${ty}`;
        if (this.originals.has(key)) {
          continue;
        }
        this.originals.set(
          key,
          copyTile(this.buffer.data, this.buffer.width, this.buffer.height, tx, ty),
        );
      }
    }
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error("PaintEngine is disposed");
    }
  }

  private assertActive(): void {
    this.assertAlive();
    if (this.lifecycle.state !== "active") {
      throw new Error("PaintEngine dab requires an active stroke");
    }
  }

  private expandDirty(x: number, y: number, radius: number): void {
    const pad = Math.ceil(Math.max(1, radius)) + 1;
    const minX = Math.max(0, Math.floor(x - pad));
    const minY = Math.max(0, Math.floor(y - pad));
    const maxX = Math.min(this.buffer.width, Math.ceil(x + pad));
    const maxY = Math.min(this.buffer.height, Math.ceil(y + pad));
    if (!this.dirty) {
      this.dirty = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      return;
    }
    const x0 = Math.min(this.dirty.x, minX);
    const y0 = Math.min(this.dirty.y, minY);
    const x1 = Math.max(this.dirty.x + this.dirty.width, maxX);
    const y1 = Math.max(this.dirty.y + this.dirty.height, maxY);
    this.dirty = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
}

function copyTile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tx: number,
  ty: number,
): Uint8ClampedArray {
  const x0 = tx * PAINT_TILE_SIZE;
  const y0 = ty * PAINT_TILE_SIZE;
  const x1 = Math.min(width, x0 + PAINT_TILE_SIZE);
  const y1 = Math.min(height, y0 + PAINT_TILE_SIZE);
  const out = new Uint8ClampedArray(Math.max(0, x1 - x0) * Math.max(0, y1 - y0) * 4);
  let i = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * 4;
      out[i] = data[idx] ?? 0;
      out[i + 1] = data[idx + 1] ?? 0;
      out[i + 2] = data[idx + 2] ?? 0;
      out[i + 3] = data[idx + 3] ?? 0;
      i += 4;
    }
  }
  return out;
}

function restoreOriginals(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  originals: ReadonlyMap<string, Uint8ClampedArray>,
): void {
  for (const [key, src] of originals) {
    const [tx, ty] = parseTileKey(key);
    writeTile(data, width, height, tx, ty, src);
  }
}

function collectPatchesFromOriginals(
  originals: ReadonlyMap<string, Uint8ClampedArray>,
  afterData: Uint8ClampedArray,
  width: number,
  height: number,
): TextureTilePatch[] {
  const patches: TextureTilePatch[] = [];
  for (const [key, before] of originals) {
    const [tx, ty] = parseTileKey(key);
    const after = copyTile(afterData, width, height, tx, ty);
    if (tilesEqual(before, after)) {
      continue;
    }
    const x0 = tx * PAINT_TILE_SIZE;
    const y0 = ty * PAINT_TILE_SIZE;
    patches.push({
      tileKey: key,
      bounds: {
        x: x0,
        y: y0,
        width: Math.min(width, x0 + PAINT_TILE_SIZE) - x0,
        height: Math.min(height, y0 + PAINT_TILE_SIZE) - y0,
      },
      before,
      after,
    });
  }
  return patches;
}

function tilesEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function parseTileKey(key: string): [number, number] {
  const [tx, ty] = key.split(",").map(Number);
  return [tx ?? 0, ty ?? 0];
}

function writeTile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tx: number,
  ty: number,
  src: Uint8ClampedArray,
): void {
  const x0 = tx * PAINT_TILE_SIZE;
  const y0 = ty * PAINT_TILE_SIZE;
  const x1 = Math.min(width, x0 + PAINT_TILE_SIZE);
  const y1 = Math.min(height, y0 + PAINT_TILE_SIZE);
  let i = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * 4;
      data[idx] = src[i] ?? 0;
      data[idx + 1] = src[i + 1] ?? 0;
      data[idx + 2] = src[i + 2] ?? 0;
      data[idx + 3] = src[i + 3] ?? 0;
      i += 4;
    }
  }
}

export function collectTilePatches(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  dirty: PixelRect | null,
): TextureTilePatch[] {
  const region = dirty ?? { x: 0, y: 0, width, height };
  const originals = new Map<string, Uint8ClampedArray>();
  const tx0 = Math.floor(region.x / PAINT_TILE_SIZE);
  const ty0 = Math.floor(region.y / PAINT_TILE_SIZE);
  const tx1 = Math.floor((region.x + Math.max(0, region.width - 1)) / PAINT_TILE_SIZE);
  const ty1 = Math.floor((region.y + Math.max(0, region.height - 1)) / PAINT_TILE_SIZE);
  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) {
      originals.set(`${tx},${ty}`, copyTile(before, width, height, tx, ty));
    }
  }
  return collectPatchesFromOriginals(originals, after, width, height);
}

export function applyTextureTilePatches(
  buffer: { width: number; height: number; data: Uint8ClampedArray },
  patches: readonly TextureTilePatch[],
  useAfter: boolean,
): void {
  for (const patch of patches) {
    const src = useAfter ? patch.after : patch.before;
    let i = 0;
    for (let y = 0; y < patch.bounds.height; y += 1) {
      for (let x = 0; x < patch.bounds.width; x += 1) {
        const px = patch.bounds.x + x;
        const py = patch.bounds.y + y;
        const idx = (py * buffer.width + px) * 4;
        buffer.data[idx] = src[i] ?? 0;
        buffer.data[idx + 1] = src[i + 1] ?? 0;
        buffer.data[idx + 2] = src[i + 2] ?? 0;
        buffer.data[idx + 3] = src[i + 3] ?? 0;
        i += 4;
      }
    }
  }
}
