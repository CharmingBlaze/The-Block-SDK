import { assertFinite } from "./scalar";
import type { BoundingBox } from "./bbox";
import { Vector3, type Vec3 } from "./vec3";

/**
 * 3D ray with origin and normalized direction.
 *
 * Provides AABB slab-method intersection (`intersectBox`) and point-at-distance
 * (`at`). Used throughout the SDK for picking, spatial queries, BVH traversal,
 * and occlusion testing.
 *
 * ## Usage
 *
 * ```ts
 * import { Ray, Vector3 } from "@modeling-kit/math";
 *
 * const ray = new Ray(new Vector3(0, 0, 0), { x: 1, y: 0, z: 0 });
 * const point = ray.at(5); // Vector3(5, 0, 0)
 * const t = ray.intersectBox(bbox); // number | null
 * ```
 *
 * @see {@link BoundingBox} for AABB intersection targets
 * @see {@link ./bvh/raycast.ts} for BVH-accelerated raycasting
 */
export class Ray {
  readonly direction: Vector3;

  constructor(
    readonly origin: Vector3,
    direction: Vec3,
  ) {
    this.direction = Vector3.from(direction).normalize();
  }

  at(t: number): Vector3 {
    assertFinite(t, "t");
    return this.origin.add(this.direction.scale(t));
  }

  /**
   * Slab intersection with an AABB. Returns the smallest non-negative hit distance, or null.
   */
  intersectBox(box: BoundingBox): number | null {
    if (box.isEmpty) {
      return null;
    }
    let tmin = Number.NEGATIVE_INFINITY;
    let tmax = Number.POSITIVE_INFINITY;
    const axes = ["x", "y", "z"] as const;
    for (const axis of axes) {
      const origin = this.origin[axis];
      const dir = this.direction[axis];
      const min = box.min[axis];
      const max = box.max[axis];
      if (dir === 0) {
        if (origin < min || origin > max) {
          return null;
        }
        continue;
      }
      let t1 = (min - origin) / dir;
      let t2 = (max - origin) / dir;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) {
        return null;
      }
    }
    if (tmax < 0) {
      return null;
    }
    return tmin >= 0 ? tmin : tmax;
  }
}
