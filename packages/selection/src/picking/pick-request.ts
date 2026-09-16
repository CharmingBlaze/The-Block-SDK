import type { PointPickDomain } from "./pick-result";

export type PickPurpose =
  | "selection"
  | "hover"
  | "tool-surface"
  | "snap"
  | "knife"
  | "placement"
  | "measurement";

export type PickBackfaceMode = "front-only" | "front-and-back";

export type ClickPickBackend = "auto" | "gpu" | "cpu";

export type HoverPickBackend = "cpu";

/** CSS box of the drawing surface. Not a DOM type. */
export interface ClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Viewport rectangle in CSS pixels relative to the canvas origin (top-left). */
export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PointPickRequest {
  readonly clientX: number;
  readonly clientY: number;
  readonly canvasRect: ClientRectLike;
  readonly domain: PointPickDomain;
  readonly purpose?: PickPurpose;
  readonly requireSurfacePoint?: boolean;
  readonly viewport?: ViewportRect;
  readonly xray?: boolean;
  readonly selectThrough?: boolean;
  readonly backfaceMode?: PickBackfaceMode;
  readonly clickBackend?: ClickPickBackend;
  readonly allowCpuFallbackOnOverflow?: boolean;
  readonly allowCpuFallbackOnRefinementFailure?: boolean;
}

export function defaultViewportRect(canvas: ClientRectLike): ViewportRect {
  return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}
