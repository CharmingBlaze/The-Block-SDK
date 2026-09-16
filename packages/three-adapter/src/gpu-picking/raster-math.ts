import type { Vector3, Matrix4 } from "three";

export function ndcToPixelX(ndcX: number, width: number): number {
  return (ndcX * 0.5 + 0.5) * width;
}

export function ndcToPixelY(ndcY: number, height: number): number {
  return (ndcY * 0.5 + 0.5) * height;
}

export function isInClipRange(p: Vector3): boolean {
  return p.x >= -1.0001 && p.x <= 1.0001 && p.y >= -1.0001 && p.y <= 1.0001 && p.z >= -1.0001 && p.z <= 1.0001;
}

export function signedArea(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
}

export function barycentric(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): { u: number; v: number; w: number } | undefined {
  const area = signedArea(ax, ay, bx, by, cx, cy);
  if (Math.abs(area) < 1e-12) {
    return undefined;
  }
  const u = signedArea(px, py, bx, by, cx, cy) / area;
  const v = signedArea(ax, ay, px, py, cx, cy) / area;
  const w = signedArea(ax, ay, bx, by, px, py) / area;
  const eps = -1e-5;
  if (u < eps || v < eps || w < eps) {
    return undefined;
  }
  return { u, v, w };
}

export function matrixWorldDet(matrix: Matrix4): number {
  const te = matrix.elements;
  const n11 = te[0]!;
  const n12 = te[4]!;
  const n13 = te[8]!;
  const n21 = te[1]!;
  const n22 = te[5]!;
  const n23 = te[9]!;
  const n31 = te[2]!;
  const n32 = te[6]!;
  const n33 = te[10]!;
  return n11 * (n22 * n33 - n23 * n32) - n12 * (n21 * n33 - n23 * n31) + n13 * (n21 * n32 - n22 * n31);
}
