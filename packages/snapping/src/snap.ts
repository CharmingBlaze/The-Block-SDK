import { Vector3, type Vec3 } from "@modeling-kit/math";

export type SnapTargetType =
  | "grid"
  | "increment"
  | "angle"
  | "vertex"
  | "edge"
  | "midpoint"
  | "face"
  | "face-center"
  | "face-surface"
  | "surface"
  | "uv-pixel"
  | "bbox"
  | "timeline";

export interface SnapResult {
  readonly matched: boolean;
  readonly targetType?: SnapTargetType;
  readonly targetId?: string;
  readonly worldPosition?: Vec3;
  readonly distance?: number;
  readonly score?: number;
}

export function snapIncrement(value: number, increment: number): number {
  if (increment <= 0) {
    return value;
  }
  return Math.round(value / increment) * increment;
}

export function snapAngle(radians: number, increment: number): number {
  return snapIncrement(radians, increment);
}

export function snapToGrid(point: Vec3, size: number): Vector3 {
  if (size <= 0) {
    return Vector3.from(point);
  }
  return new Vector3(
    snapIncrement(point.x, size),
    snapIncrement(point.y, size),
    snapIncrement(point.z, size),
  );
}

export function snapVectorIncrement(vector: Vec3, increment: number): Vector3 {
  if (increment <= 0) {
    return Vector3.from(vector);
  }
  return new Vector3(
    snapIncrement(vector.x, increment),
    snapIncrement(vector.y, increment),
    snapIncrement(vector.z, increment),
  );
}

export function snapToPoints(
  point: Vec3,
  candidates: readonly { readonly id: string; readonly position: Vec3 }[],
  radius: number,
): SnapResult {
  const origin = Vector3.from(point);
  let best: SnapResult = { matched: false };
  for (const candidate of candidates) {
    const distance = origin.distanceTo(candidate.position);
    if (distance > radius) {
      continue;
    }
    if (!best.matched || (best.distance !== undefined && distance < best.distance)) {
      best = {
        matched: true,
        targetType: "vertex",
        targetId: candidate.id,
        worldPosition: candidate.position,
        distance,
        score: radius > 0 ? 1 - distance / radius : 1,
      };
    }
  }
  return best;
}

export function closestOnSegment(
  point: Vec3,
  a: Vec3,
  b: Vec3,
): { point: Vector3; t: number; dist: number } {
  const p = Vector3.from(point);
  const va = Vector3.from(a);
  const vb = Vector3.from(b);
  const ab = vb.sub(va);
  const lenSq = ab.lengthSq();
  if (lenSq <= 1e-12) {
    return { point: va, t: 0, dist: p.distanceTo(va) };
  }
  const t = Math.max(0, Math.min(1, p.sub(va).dot(ab) / lenSq));
  const proj = va.add(ab.scale(t));
  return { point: proj, t, dist: p.distanceTo(proj) };
}

export function snapToEdge(
  point: Vec3,
  a: Vec3,
  b: Vec3,
  radius: number,
  edgeId?: string,
): SnapResult {
  const { point: proj, dist } = closestOnSegment(point, a, b);
  if (dist > radius) {
    return { matched: false };
  }
  return {
    matched: true,
    targetType: "edge",
    ...(edgeId !== undefined ? { targetId: edgeId } : {}),
    worldPosition: proj,
    distance: dist,
    score: radius > 0 ? 1 - dist / radius : 1,
  };
}

export function snapToClosestOnSegment(
  point: Vec3,
  a: Vec3,
  b: Vec3,
  radius: number,
): SnapResult {
  const origin = Vector3.from(point);
  const start = Vector3.from(a);
  const end = Vector3.from(b);
  const ab = end.sub(start);
  const lengthSq = ab.lengthSq();
  let t = 0;
  if (lengthSq > 1e-24) {
    t = Math.min(1, Math.max(0, origin.sub(start).dot(ab) / lengthSq));
  }
  const closest = start.lerp(end, t);
  const distance = origin.distanceTo(closest);
  if (radius <= 0 || distance > radius) {
    return { matched: false };
  }
  return {
    matched: true,
    targetType: "edge",
    worldPosition: closest,
    distance,
    score: 1 - distance / radius,
  };
}

/**
 * Closest point on triangle ABC to P (Ericson, Real-Time Collision Detection).
 */
export function closestPointOnTriangle(point: Vec3, a: Vec3, b: Vec3, c: Vec3): Vector3 {
  const p = Vector3.from(point);
  const va = Vector3.from(a);
  const vb = Vector3.from(b);
  const vc = Vector3.from(c);
  const ab = vb.sub(va);
  const ac = vc.sub(va);
  const ap = p.sub(va);
  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) {
    return va;
  }
  const bp = p.sub(vb);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) {
    return vb;
  }
  const vcEdge = d1 * d4 - d3 * d2;
  if (vcEdge <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return va.add(ab.scale(v));
  }
  const cp = p.sub(vc);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) {
    return vc;
  }
  const vbEdge = d5 * d2 - d1 * d6;
  if (vbEdge <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return va.add(ac.scale(w));
  }
  const vaEdge = d3 * d6 - d5 * d4;
  if (vaEdge <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return vb.add(vc.sub(vb).scale(w));
  }
  const denom = 1 / (vaEdge + vbEdge + vcEdge);
  const v = vbEdge * denom;
  const w = vcEdge * denom;
  return va.add(ab.scale(v)).add(ac.scale(w));
}
