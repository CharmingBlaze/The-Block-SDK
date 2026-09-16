import { Vector2, type WebGLRenderer } from "three";

const size = new Vector2();

export function asWebGLRenderer(renderer: unknown): WebGLRenderer | undefined {
  if (!renderer || typeof renderer !== "object") {
    return undefined;
  }
  const candidate = renderer as WebGLRenderer;
  if (
    typeof candidate.setRenderTarget === "function" &&
    typeof candidate.readRenderTargetPixels === "function" &&
    typeof candidate.render === "function"
  ) {
    return candidate;
  }
  return undefined;
}

export function drawingBufferSize(
  renderer: WebGLRenderer | undefined,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
): Vector2 {
  if (!renderer) {
    size.set(Math.max(1, Math.round(cssWidth * pixelRatio)), Math.max(1, Math.round(cssHeight * pixelRatio)));
    return size;
  }
  renderer.getDrawingBufferSize(size);
  if (size.x <= 0 || size.y <= 0) {
    size.set(Math.max(1, Math.round(cssWidth * pixelRatio)), Math.max(1, Math.round(cssHeight * pixelRatio)));
  }
  return size;
}
