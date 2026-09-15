import type { IdFactory } from "@modeling-kit/core";
import {
  compositeImage,
  createImageDocument,
  writeImageRect,
  type ImageDocument,
} from "@modeling-kit/document";
import { throwIfAborted, type IoCancelOptions } from "./cancel";

export type ImageIoOptions = IoCancelOptions;

function writePpm(width: number, height: number, rgba: Uint8ClampedArray): string {
  const lines = [`P3`, `${width} ${height}`, `255`];
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    lines.push(`${rgba[o] ?? 0} ${rgba[o + 1] ?? 0} ${rgba[o + 2] ?? 0}`);
  }
  return `${lines.join("\n")}\n`;
}

function readPpm(text: string): { width: number; height: number; rgba: Uint8ClampedArray } {
  const tokens = text
    .replace(/#[^\n]*/g, " ")
    .trim()
    .split(/\s+/);
  if (tokens[0] !== "P3") {
    throw new RangeError("Only ASCII PPM P3 image import is supported");
  }
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const max = Number(tokens[3]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Invalid PPM dimensions");
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  let t = 4;
  const scale = max > 0 ? 255 / max : 1;
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = Math.round(Number(tokens[t] ?? 0) * scale);
    rgba[i * 4 + 1] = Math.round(Number(tokens[t + 1] ?? 0) * scale);
    rgba[i * 4 + 2] = Math.round(Number(tokens[t + 2] ?? 0) * scale);
    rgba[i * 4 + 3] = 255;
    t += 3;
  }
  return { width, height, rgba };
}

export function exportImagePpm(image: ImageDocument, options: ImageIoOptions = {}): string {
  throwIfAborted(options.signal, "image export");
  return writePpm(image.width, image.height, compositeImage(image));
}

export function importImagePpm(
  text: string,
  ids: IdFactory,
  options: ImageIoOptions = {},
): ImageDocument {
  throwIfAborted(options.signal, "image import");
  const { width, height, rgba } = readPpm(text);
  const image = createImageDocument({
    id: ids.imageDocument(),
    name: "Imported",
    width,
    height,
    ids,
  });
  const layerId = image.rootLayerIds[0];
  if (!layerId) {
    return image;
  }
  const written = writeImageRect(image, layerId, { x: 0, y: 0, width, height }, rgba, width);
  return written.image;
}
