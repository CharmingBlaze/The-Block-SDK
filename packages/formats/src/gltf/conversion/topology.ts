export const PRIMITIVE_MODE_TRIANGLES = 4;

export const UNSUPPORTED_PRIMITIVE_MODES: Readonly<Record<number, string>> = {
  0: "POINTS",
  1: "LINES",
  2: "LINE_LOOP",
  3: "LINE_STRIP",
  5: "TRIANGLE_STRIP",
  6: "TRIANGLE_FAN",
};

export function primitiveModeName(mode: number): string {
  return UNSUPPORTED_PRIMITIVE_MODES[mode] ?? `mode ${mode}`;
}

export function isTriangleMode(mode: number): boolean {
  return mode === PRIMITIVE_MODE_TRIANGLES;
}
