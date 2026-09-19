# @modeling-kit/paint

**Texture painting engine.** Provides rasterization of brush strokes into RGBA tile buffers, 3D surface painting with UV hit mapping, and seam-aware dilation.

## Purpose

The `paint` package implements a high-performance texture painting system:

- **PaintEngine** — manages tiled texture buffers, dirty regions, and incremental updates
- **TextureBuffer** — RGBA pixel buffer with tiled storage (`PAINT_TILE_SIZE` = 64×64)
- **Brush rasterizer** — `drawBrushDab`, `drawBrushLine` for circular brush strokes with hardness and opacity
- **Pixel tools** — `drawPixelBrush`, `drawPixelLine`, `drawPixelRectangle`, `writePixel` for precise editing
- **3D paint** — `paintSurfaceHit`, `paintSurfaceHitOnStroke` map 3D surface clicks to UV-space brush positions
- **Seam dilation** — `dilateSeamTexels` fills seam gaps to prevent visible UV seam artifacts
- **UV mapping** — `uvToPixel` converts UV coordinates to pixel coordinates in the texture buffer

## Key Exports

```ts
// Engine
import {
  PaintEngine, applyTextureTilePatches,
  collectTilePatches, PAINT_TILE_SIZE,
  type PixelRect, type TextureTilePatch,
} from "@modeling-kit/paint";

// Buffer
import { TextureBuffer } from "@modeling-kit/paint";

// Brush rasterization
import { drawBrushDab, drawBrushLine } from "@modeling-kit/paint";

// Pixel tools
import {
  drawPixelBrush, drawPixelLine, drawPixelRectangle, writePixel,
  type PixelToolOptions, type TexturePixelPoint,
} from "@modeling-kit/paint";

// 3D painting
import {
  interpolateFaceUv, paintSurfaceHit, paintSurfaceHitOnStroke,
  resolveSurfaceHitPixel, resolveHitMaterialSlot,
  type SurfaceHit,
} from "@modeling-kit/paint";

// UV & seam utilities
import { uvToPixel, type WrapMode } from "@modeling-kit/paint";
import { dilateSeamTexels } from "@modeling-kit/paint";
import { analyzePaintUvLayout, type PaintUvLayoutAnalysis } from "@modeling-kit/paint";

// Types
import type {
  BrushMode, BrushOptions, PixelColor, TextureBufferData,
} from "@modeling-kit/paint";
```

## Usage Example

```ts
import { PaintEngine, TextureBuffer } from "@modeling-kit/paint";

// Create a texture buffer
const buffer = new TextureBuffer({ width: 1024, height: 1024 });

// Create the paint engine
const engine = new PaintEngine({
  buffer,
  layerId: "layer-1",
});

// Paint a stroke
const dab = { x: 100, y: 100, radius: 20, color: [255, 0, 0, 255], hardness: 0.5 };
engine.beginStroke();
engine.addDab(dab);
engine.addDab({ ...dab, x: 150, y: 150 });
engine.endStroke();

// Get dirty tiles
const patches = collectTilePatches(engine);
// Apply to GPU texture...
```

```ts
import { paintSurfaceHit, dilateSeamTexels } from "@modeling-kit/paint";

// Paint on a 3D surface
const hit = paintSurfaceHit({
  faceId: "f-0",
  uv: [0.5, 0.5],
  mesh,
  brush: { radius: 10, color: [0, 0, 255, 255], hardness: 0.8 },
});
engine.applyHit(hit);

// After painting, dilate seams to fill gaps
dilateSeamTexels(buffer, mesh, { channel: "default", iterations: 2 });
```

## Architecture Notes

- Textures are stored as **tiled RGBA8 buffers** — only dirty tiles are uploaded to the GPU, enabling large textures (4K+) with responsive painting.
- `paintSurfaceHit` uses **barycentric interpolation** to convert a 3D face hit with UV coordinates to the correct pixel position in the texture buffer.
- `dilateSeamTexels` is essential for preventing visible seams when textures wrap across UV boundaries.
- `PaintEngine` tracks a **dirty region** set per stroke, enabling efficient partial texture uploads.
- See `docs/guides/paint-image.md` for the full painting workflow.