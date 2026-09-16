import { BoundingBox } from "../bbox";
import type { BvhNode, BvhPrimitive } from "./types";

/** Leaf brute-force cap. Larger clusters split on the longest axis. */
export const BVH_MAX_LEAF_SIZE = 4;

export function unionPrimitiveBounds<T>(primitives: readonly BvhPrimitive<T>[]): BoundingBox {
  let box = BoundingBox.empty();
  for (const primitive of primitives) {
    box = box.union(primitive.bounds);
  }
  return box;
}

export function buildAabbBvh<T>(primitives: readonly BvhPrimitive<T>[]): BvhNode<T> | undefined {
  if (primitives.length === 0) {
    return undefined;
  }
  return build(primitives.slice());
}

function build<T>(primitives: BvhPrimitive<T>[]): BvhNode<T> {
  const bounds = unionPrimitiveBounds(primitives);
  if (primitives.length <= BVH_MAX_LEAF_SIZE) {
    return { kind: "leaf", bounds, items: primitives };
  }
  const axis = longestAxis(bounds);
  primitives.sort((left, right) => centroid(left.bounds, axis) - centroid(right.bounds, axis));
  const mid = Math.max(1, Math.min(primitives.length - 1, primitives.length >> 1));
  return {
    kind: "branch",
    bounds,
    left: build(primitives.slice(0, mid)),
    right: build(primitives.slice(mid)),
  };
}

function longestAxis(box: BoundingBox): "x" | "y" | "z" {
  const size = box.size();
  if (size.x >= size.y && size.x >= size.z) {
    return "x";
  }
  if (size.y >= size.z) {
    return "y";
  }
  return "z";
}

function centroid(box: BoundingBox, axis: "x" | "y" | "z"): number {
  return (box.min[axis] + box.max[axis]) * 0.5;
}
