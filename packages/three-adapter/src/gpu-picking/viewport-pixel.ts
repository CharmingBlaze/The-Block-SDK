import type { ClientRectLike, ViewportRect } from "@modeling-kit/selection";

export interface ViewportPixel {
  readonly x: number;
  readonly y: number;
}

/**
 * Converts a top-left CSS client coordinate into a GPU (bottom-left) pixel
 * inside the viewport's drawing-buffer rectangle. Returns undefined when the
 * pointer is outside the viewport.
 */
export function clientToViewportPixel(
  clientX: number,
  clientY: number,
  canvasRect: ClientRectLike,
  viewport: ViewportRect,
  drawingBufferWidth: number,
  drawingBufferHeight: number,
): ViewportPixel | undefined {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return undefined;
  }
  if (drawingBufferWidth <= 0 || drawingBufferHeight <= 0) {
    return undefined;
  }
  if (viewport.width <= 0 || viewport.height <= 0) {
    return undefined;
  }

  const canvasX = clientX - canvasRect.left;
  const canvasY = clientY - canvasRect.top;
  if (canvasX < 0 || canvasY < 0 || canvasX >= canvasRect.width || canvasY >= canvasRect.height) {
    return undefined;
  }
  if (
    canvasX < viewport.x ||
    canvasY < viewport.y ||
    canvasX >= viewport.x + viewport.width ||
    canvasY >= viewport.y + viewport.height
  ) {
    return undefined;
  }

  const scaleX = drawingBufferWidth / canvasRect.width;
  const scaleY = drawingBufferHeight / canvasRect.height;
  const bufferX = Math.floor(canvasX * scaleX);
  const bufferY = Math.floor(canvasY * scaleY);
  const vpX = Math.floor(viewport.x * scaleX);
  const vpY = Math.floor(viewport.y * scaleY);
  const vpW = Math.max(1, Math.round(viewport.width * scaleX));
  const vpH = Math.max(1, Math.round(viewport.height * scaleY));

  const localX = bufferX - vpX;
  const localYFromTop = bufferY - vpY;
  if (localX < 0 || localYFromTop < 0 || localX >= vpW || localYFromTop >= vpH) {
    return undefined;
  }

  return {
    x: localX,
    y: vpH - 1 - localYFromTop,
  };
}

export function defaultViewportRect(canvasRect: ClientRectLike): ViewportRect {
  return { x: 0, y: 0, width: canvasRect.width, height: canvasRect.height };
}
