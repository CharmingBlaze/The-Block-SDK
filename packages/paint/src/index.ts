export { dilateSeamTexels } from "./dilate";
export { TextureBuffer } from "./texture-buffer";
export { drawBrushDab, drawBrushLine } from "./rasterizer";
export {
  drawPixelBrush,
  drawPixelLine,
  drawPixelRectangle,
  writePixel,
  type PixelToolOptions,
  type TexturePixelPoint,
} from "./pixel-tools";
export { uvToPixel, type WrapMode } from "./uv-mapper";
export { analyzePaintUvLayout, type PaintUvLayoutAnalysis } from "./paint-uv-layout";
export {
  PaintEngine,
  applyTextureTilePatches,
  collectTilePatches,
  PAINT_TILE_SIZE,
  type PixelRect,
  type TextureTilePatch,
} from "./engine";
export {
  interpolateFaceUv,
  paintSurfaceHit,
  paintSurfaceHitOnStroke,
  resolveSurfaceHitPixel,
  resolveHitMaterialSlot,
  type SurfaceHit,
} from "./paint-3d";
export type { BrushMode, BrushOptions, PixelColor, TextureBufferData } from "./types";
