export type UVElementVisualState =
  | "default"
  | "hovered"
  | "selected"
  | "active"
  | "pinned"
  | "locked"
  | "disabled"
  | "hidden"
  | "warning";

export const UV_VISUAL_PRIORITY: readonly UVElementVisualState[] = [
  "hidden",
  "disabled",
  "locked",
  "warning",
  "active",
  "selected",
  "hovered",
  "default",
];

export type UVPointShape = "circle" | "square" | "diamond" | "sprite" | "custom" | "hidden";
export type UVEdgeStyle = "solid" | "dashed" | "seam" | "boundary" | "selected-outline" | "pixel-grid" | "custom";
export type UVFaceStyle = "fill" | "solid" | "outline" | "fill-outline" | "checker" | "stretch" | "texel-density" | "overlap" | "flipped" | "active-island";

export type UVEditorPreset = "professional" | "compact" | "pixel-art" | "touch" | "stylus" | "custom";

export interface UVVisualTheme {
  readonly pointShape: UVPointShape;
  readonly pointSize: number;
  readonly pointSizeMin: number;
  readonly pointSizeMax: number;
  readonly edgeWidth: number;
  readonly pickingRadius: number;
  readonly faceOpacity: number;
  readonly islandOpacity: number;
  readonly outlineWidth: number;
  readonly colors: {
    readonly default: string;
    readonly hover: string;
    readonly selected: string;
    readonly active: string;
    readonly seam: string;
    readonly boundary: string;
    readonly pinned: string;
    readonly warning: string;
    readonly grid: string;
    readonly checkerA: string;
    readonly checkerB: string;
  };
  readonly showTexture: boolean;
  readonly showPixelGrid: boolean;
  readonly showCheckerboard: boolean;
  readonly showLabels: boolean;
  readonly heatMapPalette: readonly string[];
}

export const DEFAULT_UV_THEME: UVVisualTheme = {
  pointShape: "circle",
  pointSize: 7,
  pointSizeMin: 4,
  pointSizeMax: 14,
  edgeWidth: 1.5,
  pickingRadius: 10,
  faceOpacity: 0.16,
  islandOpacity: 0.08,
  outlineWidth: 2,
  colors: {
    default: "#d7dde5",
    hover: "#8ec8ff",
    selected: "#4c9ffe",
    active: "#ffcc66",
    seam: "#e85d4c",
    boundary: "#7ad0a7",
    pinned: "#c084fc",
    warning: "#f97316",
    grid: "#2a3340",
    checkerA: "#1b212b",
    checkerB: "#242c38",
  },
  showTexture: true,
  showPixelGrid: false,
  showCheckerboard: true,
  showLabels: false,
  heatMapPalette: ["#3b82f6", "#22c55e", "#eab308", "#ef4444"],
};

export function themeForPreset(preset: UVEditorPreset): UVVisualTheme {
  if (preset === "compact") {
    return { ...DEFAULT_UV_THEME, pointSize: 5, pointSizeMin: 3, pointSizeMax: 9, pickingRadius: 8 };
  }
  if (preset === "pixel-art") {
    return {
      ...DEFAULT_UV_THEME,
      pointShape: "square",
      pointSize: 6,
      showPixelGrid: true,
      showCheckerboard: true,
    };
  }
  if (preset === "touch") {
    return { ...DEFAULT_UV_THEME, pointSize: 12, pickingRadius: 18, pointSizeMin: 8, pointSizeMax: 22 };
  }
  if (preset === "stylus") {
    return { ...DEFAULT_UV_THEME, pickingRadius: 8, pointSize: 6 };
  }
  return { ...DEFAULT_UV_THEME };
}

export function resolveVisualState(flags: {
  readonly hidden?: boolean;
  readonly disabled?: boolean;
  readonly locked?: boolean;
  readonly warning?: boolean;
  readonly active?: boolean;
  readonly selected?: boolean;
  readonly hovered?: boolean;
  readonly pinned?: boolean;
}): UVElementVisualState {
  if (flags.hidden) {
    return "hidden";
  }
  if (flags.disabled) {
    return "disabled";
  }
  if (flags.locked) {
    return "locked";
  }
  if (flags.warning) {
    return "warning";
  }
  if (flags.active) {
    return "active";
  }
  if (flags.selected) {
    return "selected";
  }
  if (flags.hovered) {
    return "hovered";
  }
  if (flags.pinned) {
    return "pinned";
  }
  return "default";
}

export function screenPointSize(theme: UVVisualTheme, zoom: number, dpr: number): number {
  const scaled = theme.pointSize * Math.min(2, Math.max(0.35, 0.65 + 0.12 * Math.log2(Math.max(zoom, 0.001) * dpr + 1)));
  return Math.min(theme.pointSizeMax, Math.max(theme.pointSizeMin, scaled));
}

export function hitRadiusUv(theme: UVVisualTheme, zoom: number, dpr: number): number {
  const pixels = Math.max(theme.pickingRadius, theme.edgeWidth + 4);
  return pixels / Math.max(1e-6, zoom * dpr);
}
