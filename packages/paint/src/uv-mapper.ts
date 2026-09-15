export type WrapMode = "clamp" | "repeat";

/**
 * Maps normalized UV coordinates [0, 1] to pixel coordinates on a TextureBuffer.
 */
export function uvToPixel(
  u: number,
  v: number,
  width: number,
  height: number,
  wrap: WrapMode = "clamp",
): [px: number, py: number] {
  let uu = u;
  let vv = v;

  if (wrap === "repeat") {
    uu = uu - Math.floor(uu);
    vv = vv - Math.floor(vv);
  } else {
    uu = Math.max(0, Math.min(1, uu));
    vv = Math.max(0, Math.min(1, vv));
  }

  // Standard texture coordinates: V = 0 is bottom or top depending on convention;
  // in 2D image coordinates (0, 0) is top-left, so py = (1 - v) * (height - 1) or v * (height - 1)
  const px = Math.round(uu * (width - 1));
  const py = Math.round((1 - vv) * (height - 1));

  return [px, py];
}
