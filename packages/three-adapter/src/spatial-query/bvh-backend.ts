import { BoundingBox, buildAabbBvh, Ray, raycastAabbBvh, Vector3, type BvhNode } from "@modeling-kit/math";
import { shouldRebuildSpatialIndex, spatialPrimitivesFingerprint } from "./revision";
import type { SpatialAabb, SpatialHit, SpatialQueryBackend, SpatialRay } from "./types";

/**
 * Object-level AABB BVH. Rebuilds only when the primitive fingerprint changes
 * (ids, revisions, quantized world bounds). Triangle `three-mesh-bvh` remains
 * an optional host-supplied backend.
 */
export class BvhSpatialQuery implements SpatialQueryBackend {
  private tree: BvhNode<SpatialAabb> | undefined;
  private fingerprint: string | undefined;
  private disposed = false;
  rebuildCount = 0;
  primitiveCount = 0;

  constructor(boxes: readonly SpatialAabb[] = []) {
    if (boxes.length > 0) {
      this.syncPrimitives(boxes);
    }
  }

  /** Alias of `syncPrimitives` for hosts that already hold world AABBs. */
  setBoxes(boxes: readonly SpatialAabb[]): void {
    this.syncPrimitives(boxes);
  }

  syncPrimitives(primitives: readonly SpatialAabb[]): void {
    this.assertOpen();
    const next = spatialPrimitivesFingerprint(primitives);
    if (!shouldRebuildSpatialIndex(this.fingerprint, next)) {
      return;
    }
    this.fingerprint = next;
    this.primitiveCount = primitives.length;
    this.tree = buildAabbBvh(
      primitives.map((item) => ({
        item,
        bounds: BoundingBox.fromMinMax(item.min, item.max),
      })),
    );
    this.rebuildCount += 1;
  }

  raycast(ray: SpatialRay): SpatialHit | null {
    if (this.disposed) {
      return null;
    }
    const mathRay = new Ray(Vector3.from(ray.origin), ray.direction);
    const hit = raycastAabbBvh(this.tree, mathRay);
    if (!hit) {
      return null;
    }
    const point = mathRay.at(hit.distance);
    return {
      objectId: hit.item.objectId,
      distance: hit.distance,
      point: { x: point.x, y: point.y, z: point.z },
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.tree = undefined;
    this.fingerprint = undefined;
    this.primitiveCount = 0;
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("BvhSpatialQuery is disposed");
    }
  }
}

export function createBvhSpatialQuery(boxes: readonly SpatialAabb[] = []): BvhSpatialQuery {
  return new BvhSpatialQuery(boxes);
}

/** @deprecated Use `BvhSpatialQuery`. */
export { BvhSpatialQuery as AabbTreeSpatialQuery };
