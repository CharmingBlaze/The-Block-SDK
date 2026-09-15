export type PixelColor = readonly [r: number, g: number, b: number, a: number];

export type BrushMode = "pencil" | "brush" | "eraser";

export interface BrushOptions {
  readonly mode?: BrushMode | undefined;
  readonly size: number; // radius in pixels
  readonly color: PixelColor;
  readonly opacity?: number | undefined; // [0, 1]
  readonly hardness?: number | undefined; // [0, 1]
  /** UV gutter padding in texels after a 3D dab. Default 2 on surface hits; 0 for 2D dabs. */
  readonly seamDilation?: number | undefined;
}

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextureBufferData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}
