export function triangleArea2(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return 0.5 * ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay));
}

export function triangleArea3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.5 * Math.hypot(cx, cy, cz);
}

export function angle3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const bax = ax - bx;
  const bay = ay - by;
  const baz = az - bz;
  const bcx = cx - bx;
  const bcy = cy - by;
  const bcz = cz - bz;
  const da = Math.hypot(bax, bay, baz);
  const dc = Math.hypot(bcx, bcy, bcz);
  if (da < 1e-12 || dc < 1e-12) {
    return 0;
  }
  const cos = Math.min(1, Math.max(-1, (bax * bcx + bay * bcy + baz * bcz) / (da * dc)));
  return Math.acos(cos);
}

export function angle2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return angle3(ax, ay, 0, bx, by, 0, cx, cy, 0);
}
