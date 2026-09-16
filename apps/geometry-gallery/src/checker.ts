import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** Numbered checker so UV seams and atlas islands are visible in the gallery. */
export function createCheckerTexture(size = 512, cells = 8): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("no 2d context");
  }
  const cell = size / cells;
  ctx.font = `${Math.floor(cell * 0.32)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const light = (x + y) % 2 === 0;
      ctx.fillStyle = light ? "#f4f4f5" : "#f97316";
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.fillStyle = light ? "#27272a" : "#fff7ed";
      ctx.fillText(String(y * cells + x), (x + 0.5) * cell, (y + 0.5) * cell);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
