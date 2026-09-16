import type { BoundingBox } from "../bbox";

export interface BvhPrimitive<T> {
  bounds: BoundingBox;
  readonly item: T;
}

export interface BvhLeaf<T> {
  readonly kind: "leaf";
  bounds: BoundingBox;
  readonly items: readonly BvhPrimitive<T>[];
}

export interface BvhBranch<T> {
  readonly kind: "branch";
  bounds: BoundingBox;
  readonly left: BvhNode<T>;
  readonly right: BvhNode<T>;
}

export type BvhNode<T> = BvhLeaf<T> | BvhBranch<T>;

export interface BvhRayHit<T> {
  readonly item: T;
  readonly distance: number;
}
