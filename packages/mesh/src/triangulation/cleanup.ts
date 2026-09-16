import { isCollinear3d } from "@modeling-kit/math";
import type { Vec3 } from "./types";
import { cross, distanceSquared, sub, vectorLength } from "./vec";

export function collapseNearlyDuplicateAndCollinear(
  points: readonly Vec3[],
  epsilon: number,
): { points: Vec3[]; indices: number[] } {
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const prevIdx = indices.length === 0 ? points.length - 1 : indices[indices.length - 1]!;
    if (distanceSquared(points[i]!, points[prevIdx]!) <= epsilon * epsilon) {
      continue;
    }
    indices.push(i);
  }
  if (
    indices.length >= 2 &&
    distanceSquared(points[indices[0]!]!, points[indices[indices.length - 1]!]!) <= epsilon * epsilon
  ) {
    indices.pop();
  }

  let changed = true;
  while (changed && indices.length > 3) {
    changed = false;
    for (let i = 0; i < indices.length; i++) {
      const prev = points[indices[(i - 1 + indices.length) % indices.length]!]!;
      const curr = points[indices[i]!]!;
      const next = points[indices[(i + 1) % indices.length]!]!;
      const ab = sub(curr, prev);
      const bc = sub(next, curr);
      const crossLen = vectorLength(cross(ab, bc));
      const denom = vectorLength(ab) * vectorLength(bc);
      const nearlyCollinear = denom > epsilon && crossLen <= epsilon * denom;
      if (nearlyCollinear || isCollinear3d(prev, curr, next)) {
        indices.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return { points: indices.map((i) => points[i]!), indices };
}
