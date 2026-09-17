export type ViewportRenderMode =
  | "solid"
  | "material"
  | "textured"
  | "unlit"
  | "wireframe"
  | "shaded-wireframe"
  | "normals"
  | "uv-checker"
  | "game-preview";

export type ShadowQuality = "off" | "low" | "medium" | "high";
export type ViewportTextureFiltering = "nearest" | "linear";

/** Presentation-only settings. They are never serialized into the model. */
export interface ViewportRenderSettings {
  readonly mode: ViewportRenderMode;
  readonly shadows: ShadowQuality;
  readonly showGround: boolean;
  readonly showGrid: boolean;
  readonly showTopologyEdges: boolean;
  readonly showTriangulation: boolean;
  readonly flatShading: boolean;
  readonly textureFiltering: ViewportTextureFiltering;
  readonly shadowSoftness: number;
  readonly shadowBias: number;
  readonly shadowNormalBias: number;
  /** Maximum world-space width/height of the fitted shadow volume. */
  readonly maxShadowFitSize: number;
}

export type ViewportRenderSettingsInput = Partial<ViewportRenderSettings>;

export const DEFAULT_VIEWPORT_RENDER_SETTINGS: Readonly<ViewportRenderSettings> = Object.freeze({
  mode: "solid",
  shadows: "medium",
  showGround: true,
  showGrid: true,
  showTopologyEdges: false,
  showTriangulation: false,
  flatShading: true,
  textureFiltering: "nearest",
  shadowSoftness: 2,
  shadowBias: -0.00012,
  shadowNormalBias: 0.012,
  maxShadowFitSize: 100,
});

export function resolveViewportRenderSettings(
  input: ViewportRenderSettingsInput = {},
  base: ViewportRenderSettings = DEFAULT_VIEWPORT_RENDER_SETTINGS,
): ViewportRenderSettings {
  return { ...base, ...input };
}

export function shadowMapSizeForQuality(quality: ShadowQuality): number {
  if (quality === "off") return 0;
  if (quality === "low") return 512;
  if (quality === "medium") return 1024;
  return 2048;
}

export function gtaoSamplesForQuality(quality: ShadowQuality | string): number {
  if (quality === "off") return 0;
  if (quality === "low") return 8;
  if (quality === "medium") return 16;
  return 32;
}

export function modeSupportsShadows(mode: ViewportRenderMode): boolean {
  return mode === "solid" || mode === "material" || mode === "textured" || mode === "shaded-wireframe" || mode === "game-preview";
}

export function modeShowsTopology(mode: ViewportRenderMode): boolean {
  return mode === "wireframe" || mode === "shaded-wireframe";
}

/** WebGL-independent state used by the controller and tests. */
export class ViewportRenderState {
  private current: ViewportRenderSettings;
  private disposed = false;
  private viewport = { width: 1, height: 1, pixelRatio: 1 };

  constructor(initial: ViewportRenderSettingsInput = {}) {
    this.current = resolveViewportRenderSettings(initial);
  }

  get settings(): Readonly<ViewportRenderSettings> { return this.current; }
  get size(): Readonly<{ width: number; height: number; pixelRatio: number }> { return this.viewport; }

  setRenderMode(mode: ViewportRenderMode): void { this.update({ mode }); }

  update(next: ViewportRenderSettingsInput): void {
    this.assertAlive();
    this.current = resolveViewportRenderSettings(next, this.current);
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    this.assertAlive();
    this.viewport = {
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
      pixelRatio: Math.max(0.25, pixelRatio),
    };
  }

  shadowsEnabled(): boolean {
    return this.current.shadows !== "off" && modeSupportsShadows(this.current.mode);
  }

  topologyEdgesVisible(): boolean {
    return this.current.showTopologyEdges || modeShowsTopology(this.current.mode);
  }

  dispose(): void { this.disposed = true; }

  private assertAlive(): void {
    if (this.disposed) throw new Error("Viewport render state has been disposed");
  }
}

export type ViewportDisplayMode = ViewportRenderMode;
export type ViewportDisplaySettings = ViewportRenderSettings;
export type ViewportDisplaySettingsInput = ViewportRenderSettingsInput;
export const DEFAULT_VIEWPORT_DISPLAY_SETTINGS = DEFAULT_VIEWPORT_RENDER_SETTINGS;
export const resolveViewportDisplaySettings = resolveViewportRenderSettings;
export const ViewportDisplayState = ViewportRenderState;
