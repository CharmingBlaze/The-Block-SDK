export { dilateSeamTexels } from "./dilate";
export { TextureBuffer } from "./texture-buffer";
export { drawBrushDab, drawBrushLine } from "./rasterizer";
export { uvToPixel, type WrapMode } from "./uv-mapper";
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
  resolveHitMaterialSlot,
  type SurfaceHit,
} from "./paint-3d";
export type { BrushMode, BrushOptions, PixelColor, TextureBufferData } from "./types";
