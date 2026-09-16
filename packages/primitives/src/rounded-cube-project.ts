export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Move a point on the outer box onto the rounded-box surface. */
export function projectOntoRoundedBox(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  radius: number,
): [number, number, number] {
  const ix = Math.max(hx - radius, 0);
  const iy = Math.max(hy - radius, 0);
  const iz = Math.max(hz - radius, 0);
  const qx = clamp(x, -ix, ix);
  const qy = clamp(y, -iy, iy);
  const qz = clamp(z, -iz, iz);
  const dx = x - qx;
  const dy = y - qy;
  const dz = z - qz;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-12) {
    return [x, y, z];
  }
  const scale = radius / length;
  return [qx + dx * scale, qy + dy * scale, qz + dz * scale];
}

export function roundedBoxNormal(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  radius: number,
): [number, number, number] {
  const ix = Math.max(hx - radius, 0);
  const iy = Math.max(hy - radius, 0);
  const iz = Math.max(hz - radius, 0);
  const dx = x - clamp(x, -ix, ix);
  const dy = y - clamp(y, -iy, iy);
  const dz = z - clamp(z, -iz, iz);
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-12) {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    if (ax >= ay && ax >= az) {
      return [x >= 0 ? 1 : -1, 0, 0];
    }
    if (ay >= az) {
      return [0, y >= 0 ? 1 : -1, 0];
    }
    return [0, 0, z >= 0 ? 1 : -1];
  }
  return [dx / length, dy / length, dz / length];
}
