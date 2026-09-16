export type GltfWeldMode = "none" | "position" | "attributes";

export function weldKey(
  mode: GltfWeldMode,
  epsilon: number,
  px: number,
  py: number,
  pz: number,
  extra: string,
): string | undefined {
  if (mode === "none") {
    return undefined;
  }
  const quantize = 1 / Math.max(epsilon, 1e-8);
  const position = `${Math.round(px * quantize)}:${Math.round(py * quantize)}:${Math.round(pz * quantize)}`;
  if (mode === "position") {
    return position;
  }
  return `${position}|${extra}`;
}

export function quantizeTuple(values: readonly number[] | undefined, epsilon: number): string {
  if (!values) {
    return "-";
  }
  const quantize = 1 / Math.max(epsilon, 1e-8);
  return values.map((value) => Math.round(value * quantize)).join(":");
}
