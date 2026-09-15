import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createImageDocument,
  createGroupLayer,
  createModelDocument,
  createRasterLayer,
  addImageLayer,
  applyTilePatches,
  compositeImage,
  getLayer,
  parseDocument,
  readImagePixel,
  removeImageLayer,
  serializeDocument,
  updateLayerProperties,
  writeImageRect,
} from "@modeling-kit/document";
import { describe, expect, it } from "vitest";

describe("tiled image documents", () => {
  it("writes across tiles and round-trips sparse storage", () => {
    const ids = createSequenceIdFactory("img");
    const doc = createModelDocument({ ids });
    const image = createImageDocument({
      id: ids.imageDocument(),
      width: 80,
      height: 80,
      tileSize: 64,
      ids,
    });
    const layerId = image.layers[0]!.id;
    const source = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < source.length; i += 4) {
      source[i] = 12;
      source[i + 1] = 34;
      source[i + 2] = 56;
      source[i + 3] = 255;
    }
    const written = writeImageRect(image, layerId, { x: 60, y: 60, width: 20, height: 20 }, source, 20);
    expect(written.dirtyTiles.length).toBe(4);
    expect(readImagePixel(written.image, layerId, 61, 61)).toEqual([12, 34, 56, 255]);
    expect(readImagePixel(written.image, layerId, 0, 0)).toEqual([0, 0, 0, 0]);
    doc.images.set(written.image);
    const loaded = parseDocument(serializeDocument(doc));
    const again = loaded.images.get(image.id)!;
    expect(readImagePixel(again, layerId, 61, 61)).toEqual([12, 34, 56, 255]);
    expect(again.layers[0]!.tiles.length).toBe(4);
  });

  it("adds grouped layers, composites multiply, and drops empty tiles", () => {
    const ids = createSequenceIdFactory("img-layers");
    let image = createImageDocument({
      id: ids.imageDocument(),
      width: 64,
      height: 64,
      tileSize: 64,
      ids,
    });
    const baseId = image.layers[0]!.id;
    const group = createGroupLayer(ids.layer(), "Folder");
    const overlay = createRasterLayer(ids.layer(), "Multiply");
    image = addImageLayer(image, group);
    image = addImageLayer(image, overlay, group.id);
    image = updateLayerProperties(image, overlay.id, { blendMode: "multiply", opacity: 1 });

    const white = new Uint8ClampedArray(16 * 16 * 4);
    white.fill(255);
    const red = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < red.length; i += 4) {
      red[i] = 128;
      red[i + 1] = 0;
      red[i + 2] = 0;
      red[i + 3] = 255;
    }
    image = writeImageRect(image, baseId, { x: 0, y: 0, width: 16, height: 16 }, white, 16).image;
    image = writeImageRect(image, overlay.id, { x: 0, y: 0, width: 16, height: 16 }, red, 16).image;
    const pixels = compositeImage(image);
    expect(pixels[0]).toBe(128);
    expect(pixels[1]).toBe(0);

    const clear = new Uint8ClampedArray(16 * 16 * 4);
    image = writeImageRect(image, overlay.id, { x: 0, y: 0, width: 16, height: 16 }, clear, 16).image;
    expect(getLayer(image, overlay.id)?.tiles.length).toBe(0);

    const patched = writeImageRect(image, overlay.id, { x: 0, y: 0, width: 16, height: 16 }, red, 16);
    image = applyTilePatches(patched.image, patched.patches, false);
    expect(readImagePixel(image, overlay.id, 1, 1)[3]).toBe(0);
    image = applyTilePatches(image, patched.patches, true);
    expect(readImagePixel(image, overlay.id, 1, 1)[0]).toBe(128);

    image = removeImageLayer(image, group.id);
    expect(image.layers.some((layer) => layer.id === overlay.id)).toBe(false);
    expect(image.layers.some((layer) => layer.id === baseId)).toBe(true);
  });
});
