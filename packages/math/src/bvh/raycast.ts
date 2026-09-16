import type { BoundingBox } from "../bbox";
import type { Ray } from "../ray";
import type { BvhNode, BvhPrimitive, BvhRayHit } from "./types";

export type BvhLeafTester<T> = (item: T, primitive: BvhPrimitive<T>, ray: Ray) => number | null;

interface RaycastState<T> {
  best: BvhRayHit<T> | null;
}

export function raycastAabbBvh<T>(
  root: BvhNode<T> | undefined,
  ray: Ray,
  testLeaf?: BvhLeafTester<T>,
): BvhRayHit<T> | null {
  if (!root) {
    return null;
  }
  const state: RaycastState<T> = { best: null };
  visit(root, ray, testLeaf ?? defaultLeafTest, state);
  return state.best;
}

function defaultLeafTest<T>(_item: T, primitive: BvhPrimitive<T>, ray: Ray): number | null {
  return boxHitDistance(primitive.bounds, ray);
}

export function boxHitDistance(bounds: BoundingBox, ray: Ray): number | null {
  if (bounds.containsPoint(ray.origin)) {
    return 0;
  }
  return ray.intersectBox(bounds);
}

function visit<T>(
  node: BvhNode<T>,
  ray: Ray,
  testLeaf: BvhLeafTester<T>,
  state: RaycastState<T>,
): void {
  const originInside = node.bounds.containsPoint(ray.origin);
  const tBox = ray.intersectBox(node.bounds);
  if (tBox === null && !originInside) {
    return;
  }
  if (state.best && tBox !== null && tBox > state.best.distance && !originInside) {
    return;
  }
  if (node.kind === "leaf") {
    for (const primitive of node.items) {
      const distance = testLeaf(primitive.item, primitive, ray);
      if (distance === null || distance < 0) {
        continue;
      }
      if (!state.best || distance < state.best.distance) {
        state.best = { item: primitive.item, distance };
      }
    }
    return;
  }
  visit(node.left, ray, testLeaf, state);
  visit(node.right, ray, testLeaf, state);
}
