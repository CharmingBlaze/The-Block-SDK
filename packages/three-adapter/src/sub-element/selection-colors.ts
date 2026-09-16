import type { EdgeRole, ElementVisualState, SubElementVisualTheme } from "./types";
import { hexToRgb } from "./mesh-query";

export interface RgbOpacity {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly opacity: number;
}

export function vertexDisplayColor(
  theme: SubElementVisualTheme,
  state: ElementVisualState,
): RgbOpacity {
  const style = theme.vertices.states[state];
  const [r, g, b] = hexToRgb(style.color);
  return { r, g, b, opacity: state === "hidden" ? 0 : style.opacity };
}

export function edgeDisplayColor(
  theme: SubElementVisualTheme,
  role: EdgeRole,
  state: ElementVisualState,
): RgbOpacity {
  const roleStyle = theme.edges.roles[role];
  const stateStyle = theme.edges.states[state];
  const color = state === "default" ? roleStyle.color : stateStyle.color;
  const opacity = state === "hidden" ? 0 : state === "default" ? roleStyle.opacity : stateStyle.opacity;
  const [r, g, b] = hexToRgb(color);
  return { r, g, b, opacity };
}

export function faceFillColor(
  theme: SubElementVisualTheme,
  state: ElementVisualState,
  overlayStyle: SubElementVisualTheme["faces"]["style"],
): RgbOpacity {
  const faceStyle = theme.faces.states[state];
  const [r, g, b] = hexToRgb(faceStyle.color);
  const opacity = overlayStyle === "tint" ? Math.min(0.2, faceStyle.opacity) : faceStyle.opacity;
  return { r, g, b, opacity };
}
