import { brand, type IdFactory, type ImageDocumentId, type LayerId, type TileKey } from "@modeling-kit/core";
import { bytesToBase64, base64ToBytes } from "./base64";
import type {
  ImageDocument,
  ImageLayer,
  LayerBlendMode,
  PixelRect,
  PixelTile,
} from "./types";

export const DEFAULT_IMAGE_TILE_SIZE = 64;

export function makeTileKey(tx: number, ty: number): TileKey {
  return brand(`${tx},${ty}`);
}

export function createImageDocument(input: {
  readonly id: ImageDocumentId;
  readonly name?: string;
  readonly width: number;
  readonly height: number;
  readonly ids: IdFactory;
  readonly tileSize?: number;
  readonly colorSpace?: ImageDocument["colorSpace"];
}): ImageDocument {
  if (input.width <= 0 || input.height <= 0) {
    throw new RangeError("ImageDocument width and height must be positive");
  }
  const layerId = input.ids.layer();
  const layer: ImageLayer = createRasterLayer(layerId, "Layer 1");
  return {
    id: input.id,
    name: input.name ?? "Image",
    width: input.width,
    height: input.height,
    colorSpace: input.colorSpace ?? "srgb",
    pixelFormat: "rgba8",
    tileSize: input.tileSize ?? DEFAULT_IMAGE_TILE_SIZE,
    rootLayerIds: [layerId],
    layers: [layer],
    metadata: {},
  };
}

export function createRasterLayer(id: LayerId, name: string): ImageLayer {
  return {
    id,
    name,
    type: "raster",
    parentId: null,
    childIds: [],
    visible: true,
    opacity: 1,
    blendMode: "normal",
    locked: false,
    alphaLock: false,
    tiles: [],
    propertyRevision: 0,
    pixelRevision: 0,
    metadata: {},
  };
}

export function createGroupLayer(
  id: LayerId,
  name: string,
  childIds: readonly LayerId[] = [],
): ImageLayer {
  return {
    ...createRasterLayer(id, name),
    type: "group",
    childIds,
  };
}

export interface PixelTilePatch {
  readonly imageDocumentId: ImageDocumentId;
  readonly layerId: LayerId;
  readonly tileKey: TileKey;
  readonly bounds: PixelRect;
  readonly before: Uint8ClampedArray;
  readonly after: Uint8ClampedArray;
}

export function decodeTilePixels(tile: PixelTile, tileSize: number): Uint8ClampedArray {
  const bytes = base64ToBytes(tile.pixelsBase64);
  const expected = tileSize * tileSize * 4;
  if (bytes.length === expected) {
    return new Uint8ClampedArray(bytes);
  }
  const out = new Uint8ClampedArray(expected);
  out.set(bytes.subarray(0, Math.min(bytes.length, expected)));
  return out;
}

export function encodeTilePixels(pixels: Uint8ClampedArray): string {
  return bytesToBase64(new Uint8Array(pixels));
}

export function getLayer(image: ImageDocument, layerId: LayerId): ImageLayer | undefined {
  return image.layers.find((layer) => layer.id === layerId);
}

function tileCoord(value: number, tileSize: number): number {
  return Math.floor(value / tileSize);
}

export function writeImageRect(
  image: ImageDocument,
  layerId: LayerId,
  rect: PixelRect,
  source: Uint8ClampedArray,
  sourceWidth: number,
): { image: ImageDocument; patches: PixelTilePatch[]; dirtyTiles: TileKey[] } {
  const layer = getLayer(image, layerId);
  if (!layer) {
    throw new RangeError(`Missing layer ${layerId}`);
  }
  if (layer.locked) {
    throw new Error(`Layer ${layerId} is locked`);
  }
  const tileSize = image.tileSize;
  const tiles = new Map(layer.tiles.map((tile) => [tile.key, tile]));
  const patches: PixelTilePatch[] = [];
  const dirty = new Set<TileKey>();

  const minX = Math.max(0, rect.x);
  const minY = Math.max(0, rect.y);
  const maxX = Math.min(image.width, rect.x + rect.width);
  const maxY = Math.min(image.height, rect.y + rect.height);

  const tx0 = tileCoord(minX, tileSize);
  const ty0 = tileCoord(minY, tileSize);
  const tx1 = tileCoord(Math.max(minX, maxX - 1), tileSize);
  const ty1 = tileCoord(Math.max(minY, maxY - 1), tileSize);

  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) {
      const key = makeTileKey(tx, ty);
      const existing = tiles.get(key);
      const pixels = existing
        ? decodeTilePixels(existing, tileSize)
        : new Uint8ClampedArray(tileSize * tileSize * 4);
      const before = new Uint8ClampedArray(pixels);
      let changed = false;
      const originX = tx * tileSize;
      const originY = ty * tileSize;
      const x0 = Math.max(minX, originX);
      const y0 = Math.max(minY, originY);
      const x1 = Math.min(maxX, originX + tileSize);
      const y1 = Math.min(maxY, originY + tileSize);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const srcX = x - rect.x;
          const srcY = y - rect.y;
          const srcIdx = (srcY * sourceWidth + srcX) * 4;
          const dstIdx = ((y - originY) * tileSize + (x - originX)) * 4;
          const r = source[srcIdx] ?? 0;
          const g = source[srcIdx + 1] ?? 0;
          const b = source[srcIdx + 2] ?? 0;
          const a = source[srcIdx + 3] ?? 0;
          if (
            pixels[dstIdx] !== r ||
            pixels[dstIdx + 1] !== g ||
            pixels[dstIdx + 2] !== b ||
            pixels[dstIdx + 3] !== a
          ) {
            pixels[dstIdx] = r;
            pixels[dstIdx + 1] = g;
            pixels[dstIdx + 2] = b;
            pixels[dstIdx + 3] = a;
            changed = true;
          }
        }
      }
      if (!changed) {
        continue;
      }
      dirty.add(key);
      patches.push({
        imageDocumentId: image.id,
        layerId,
        tileKey: key,
        bounds: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
        before,
        after: new Uint8ClampedArray(pixels),
      });
      if (isEmptyTile(pixels)) {
        tiles.delete(key);
      } else {
        tiles.set(key, { key, tx, ty, pixelsBase64: encodeTilePixels(pixels) });
      }
    }
  }

  const nextLayer: ImageLayer = {
    ...layer,
    tiles: [...tiles.values()].sort((a, b) => String(a.key).localeCompare(String(b.key))),
    pixelRevision: layer.pixelRevision + 1,
  };
  return {
    image: replaceLayer(image, nextLayer),
    patches,
    dirtyTiles: [...dirty],
  };
}

export function applyTilePatches(image: ImageDocument, patches: readonly PixelTilePatch[], useAfter: boolean): ImageDocument {
  let next = image;
  for (const patch of patches) {
    const layer = getLayer(next, patch.layerId);
    if (!layer) {
      continue;
    }
    const [tx, ty] = String(patch.tileKey).split(",").map(Number);
    const pixels = useAfter ? patch.after : patch.before;
    const tiles = layer.tiles.filter((tile) => tile.key !== patch.tileKey);
    if (!isEmptyTile(pixels)) {
      tiles.push({
        key: patch.tileKey,
        tx: tx ?? 0,
        ty: ty ?? 0,
        pixelsBase64: encodeTilePixels(pixels),
      });
    }
    next = replaceLayer(next, {
      ...layer,
      tiles: tiles.sort((a, b) => String(a.key).localeCompare(String(b.key))),
      pixelRevision: layer.pixelRevision + 1,
    });
  }
  return next;
}

export function readImagePixel(
  image: ImageDocument,
  layerId: LayerId,
  x: number,
  y: number,
): readonly [number, number, number, number] {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return [0, 0, 0, 0];
  }
  const layer = getLayer(image, layerId);
  if (!layer) {
    return [0, 0, 0, 0];
  }
  const tileSize = image.tileSize;
  const key = makeTileKey(tileCoord(x, tileSize), tileCoord(y, tileSize));
  const tile = layer.tiles.find((item) => item.key === key);
  if (!tile) {
    return [0, 0, 0, 0];
  }
  const pixels = decodeTilePixels(tile, tileSize);
  const lx = x - tile.tx * tileSize;
  const ly = y - tile.ty * tileSize;
  const idx = (ly * tileSize + lx) * 4;
  return [pixels[idx] ?? 0, pixels[idx + 1] ?? 0, pixels[idx + 2] ?? 0, pixels[idx + 3] ?? 0];
}

export function compositeImage(image: ImageDocument): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  const stack = [...image.rootLayerIds];
  const visited = new Set<string>();
  let steps = 0;
  const maxSteps = image.layers.length * 8 + 1;
  while (stack.length > 0 && steps < maxSteps) {
    steps += 1;
    const id = stack.shift()!;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    const layer = getLayer(image, id);
    if (!layer || !layer.visible || layer.opacity <= 0) {
      continue;
    }
    if (layer.type === "group") {
      stack.unshift(...layer.childIds);
      continue;
    }
    blitLayer(image, layer, out, layer.opacity, layer.blendMode);
  }
  return out;
}

function blitLayer(
  image: ImageDocument,
  layer: ImageLayer,
  dest: Uint8ClampedArray,
  opacity: number,
  blend: LayerBlendMode,
): void {
  const tileSize = image.tileSize;
  for (const tile of layer.tiles) {
    const pixels = decodeTilePixels(tile, tileSize);
    for (let ly = 0; ly < tileSize; ly += 1) {
      const y = tile.ty * tileSize + ly;
      if (y < 0 || y >= image.height) {
        continue;
      }
      for (let lx = 0; lx < tileSize; lx += 1) {
        const x = tile.tx * tileSize + lx;
        if (x < 0 || x >= image.width) {
          continue;
        }
        const srcIdx = (ly * tileSize + lx) * 4;
        const dstIdx = (y * image.width + x) * 4;
        const srcA = ((pixels[srcIdx + 3] ?? 0) / 255) * opacity;
        if (srcA <= 0) {
          continue;
        }
        const dstA = (dest[dstIdx + 3] ?? 0) / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) {
          continue;
        }
        const srcR = pixels[srcIdx] ?? 0;
        const srcG = pixels[srcIdx + 1] ?? 0;
        const srcB = pixels[srcIdx + 2] ?? 0;
        const dstR = dest[dstIdx] ?? 0;
        const dstG = dest[dstIdx + 1] ?? 0;
        const dstB = dest[dstIdx + 2] ?? 0;
        const [br, bg, bb] = blendChannels(srcR, srcG, srcB, dstR, dstG, dstB, blend);
        dest[dstIdx] = Math.round((br * srcA + dstR * dstA * (1 - srcA)) / outA);
        dest[dstIdx + 1] = Math.round((bg * srcA + dstG * dstA * (1 - srcA)) / outA);
        dest[dstIdx + 2] = Math.round((bb * srcA + dstB * dstA * (1 - srcA)) / outA);
        dest[dstIdx + 3] = Math.round(outA * 255);
      }
    }
  }
}

function blendChannels(
  sr: number,
  sg: number,
  sb: number,
  dr: number,
  dg: number,
  db: number,
  mode: LayerBlendMode,
): [number, number, number] {
  if (mode === "multiply") {
    return [(sr * dr) / 255, (sg * dg) / 255, (sb * db) / 255];
  }
  if (mode === "add") {
    return [Math.min(255, sr + dr), Math.min(255, sg + dg), Math.min(255, sb + db)];
  }
  if (mode === "screen") {
    return [
      255 - ((255 - sr) * (255 - dr)) / 255,
      255 - ((255 - sg) * (255 - dg)) / 255,
      255 - ((255 - sb) * (255 - db)) / 255,
    ];
  }
  return [sr, sg, sb];
}

export function replaceLayer(image: ImageDocument, layer: ImageLayer): ImageDocument {
  return {
    ...image,
    layers: image.layers.map((item) => (item.id === layer.id ? layer : item)),
  };
}

export function updateLayerProperties(
  image: ImageDocument,
  layerId: LayerId,
  patch: Partial<Pick<ImageLayer, "name" | "visible" | "opacity" | "blendMode" | "locked" | "alphaLock">>,
): ImageDocument {
  const layer = getLayer(image, layerId);
  if (!layer) {
    throw new RangeError(`Missing layer ${layerId}`);
  }
  return replaceLayer(image, {
    ...layer,
    ...patch,
    propertyRevision: layer.propertyRevision + 1,
  });
}

export function reorderRootLayers(image: ImageDocument, orderedIds: readonly LayerId[]): ImageDocument {
  const present = new Set(image.rootLayerIds);
  const next = orderedIds.filter((id) => present.has(id));
  for (const id of image.rootLayerIds) {
    if (!next.includes(id)) {
      next.push(id);
    }
  }
  return { ...image, rootLayerIds: next };
}

export function addImageLayer(
  image: ImageDocument,
  layer: ImageLayer,
  parentId: LayerId | null = null,
): ImageDocument {
  if (image.layers.some((item) => item.id === layer.id)) {
    throw new RangeError(`Layer ${layer.id} already exists`);
  }
  if (!parentId) {
    return {
      ...image,
      layers: [...image.layers, { ...layer, parentId: null }],
      rootLayerIds: [...image.rootLayerIds, layer.id],
    };
  }
  const parent = getLayer(image, parentId);
  if (!parent) {
    throw new RangeError(`Missing parent layer ${parentId}`);
  }
  if (parent.type !== "group") {
    throw new Error(`Layer ${parentId} cannot own children`);
  }
  const child: ImageLayer = { ...layer, parentId };
  const nextParent: ImageLayer = {
    ...parent,
    childIds: [...parent.childIds, layer.id],
    propertyRevision: parent.propertyRevision + 1,
  };
  return {
    ...image,
    layers: [...image.layers.map((item) => (item.id === parentId ? nextParent : item)), child],
  };
}

export function removeImageLayer(image: ImageDocument, layerId: LayerId): ImageDocument {
  const layer = getLayer(image, layerId);
  if (!layer) {
    throw new RangeError(`Missing layer ${layerId}`);
  }
  if (image.layers.length <= 1) {
    throw new Error("ImageDocument must keep at least one layer");
  }
  const drop = new Set<string>([layerId, ...collectDescendants(image, layerId)]);
  let next: ImageDocument = {
    ...image,
    layers: image.layers.filter((item) => !drop.has(item.id)),
    rootLayerIds: image.rootLayerIds.filter((id) => !drop.has(id)),
  };
  if (layer.parentId) {
    const parent = getLayer(next, layer.parentId);
    if (parent) {
      next = replaceLayer(next, {
        ...parent,
        childIds: parent.childIds.filter((id) => id !== layerId),
        propertyRevision: parent.propertyRevision + 1,
      });
    }
  }
  if (next.layers.length === 0 || next.rootLayerIds.length === 0) {
    throw new Error("ImageDocument must keep at least one root layer");
  }
  return next;
}

function collectDescendants(image: ImageDocument, layerId: LayerId): LayerId[] {
  const layer = getLayer(image, layerId);
  if (!layer) {
    return [];
  }
  const ids: LayerId[] = [];
  for (const childId of layer.childIds) {
    ids.push(childId, ...collectDescendants(image, childId));
  }
  return ids;
}

function isEmptyTile(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 0) !== 0) {
      return false;
    }
  }
  return true;
}

export function normalizeImageDocument(raw: unknown): ImageDocument {
  if (!raw || typeof raw !== "object") {
    throw new RangeError("ImageDocument must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string") {
    throw new RangeError("ImageDocument must have an id");
  }
  const width = typeof record.width === "number" ? record.width : 1;
  const height = typeof record.height === "number" ? record.height : 1;
  const layersRaw = Array.isArray(record.layers) ? record.layers : [];
  const layers = layersRaw.map((item) => normalizeLayer(item));
  const rootLayerIds = Array.isArray(record.rootLayerIds)
    ? (record.rootLayerIds as LayerId[])
    : layers.map((layer) => layer.id);
  return {
    id: record.id as ImageDocumentId,
    name: typeof record.name === "string" ? record.name : "Image",
    width,
    height,
    colorSpace: record.colorSpace === "linear" ? "linear" : "srgb",
    pixelFormat: "rgba8",
    tileSize: typeof record.tileSize === "number" && record.tileSize > 0 ? record.tileSize : DEFAULT_IMAGE_TILE_SIZE,
    rootLayerIds,
    layers,
    metadata: record.metadata && typeof record.metadata === "object" ? { ...(record.metadata as Record<string, unknown>) } : {},
  };
}

function normalizeLayer(raw: unknown): ImageLayer {
  if (!raw || typeof raw !== "object") {
    throw new RangeError("Image layer must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string") {
    throw new RangeError("Image layer must have an id");
  }
  const type = record.type === "group" || record.type === "mask" ? record.type : "raster";
  const tiles = Array.isArray(record.tiles)
    ? record.tiles.filter(isTile).map((tile) => ({
        key: tile.key as TileKey,
        tx: tile.tx,
        ty: tile.ty,
        pixelsBase64: tile.pixelsBase64,
      }))
    : [];
  return {
    id: record.id as LayerId,
    name: typeof record.name === "string" ? record.name : "Layer",
    type,
    parentId: typeof record.parentId === "string" ? (record.parentId as LayerId) : null,
    childIds: Array.isArray(record.childIds) ? (record.childIds as LayerId[]) : [],
    visible: record.visible !== false,
    opacity: typeof record.opacity === "number" ? record.opacity : 1,
    blendMode:
      record.blendMode === "multiply" || record.blendMode === "add" || record.blendMode === "screen"
        ? record.blendMode
        : "normal",
    locked: record.locked === true,
    alphaLock: record.alphaLock === true,
    tiles,
    propertyRevision: typeof record.propertyRevision === "number" ? record.propertyRevision : 0,
    pixelRevision: typeof record.pixelRevision === "number" ? record.pixelRevision : 0,
    metadata: record.metadata && typeof record.metadata === "object" ? { ...(record.metadata as Record<string, unknown>) } : {},
  };
}

function isTile(value: unknown): value is { key: string; tx: number; ty: number; pixelsBase64: string } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === "string" &&
    typeof record.tx === "number" &&
    typeof record.ty === "number" &&
    typeof record.pixelsBase64 === "string"
  );
}
