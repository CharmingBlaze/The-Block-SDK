import { unionPrimitiveBounds } from "./build";
import type { BvhNode } from "./types";
import type { BoundingBox } from "../bbox";

/**
 * Keep the existing split topology and rewrite leaf/parent AABBs.
 * Use this when primitive connectivity is unchanged (vertex translate)
 * so callers do not rebuild the tree.
 */
export function refitAabbBvh<T>(
  root: BvhNode<T> | undefined,
  boundsOf: (item: T) => BoundingBox,
): void {
  if (!root) {
    return;
  }
  refitNode(root, boundsOf);
}

function refitNode<T>(node: BvhNode<T>, boundsOf: (item: T) => BoundingBox): BoundingBox {
  if (node.kind === "leaf") {
    for (const primitive of node.items) {
      primitive.bounds = boundsOf(primitive.item);
    }
    node.bounds = unionPrimitiveBounds(node.items);
    return node.bounds;
  }
  const left = refitNode(node.left, boundsOf);
  const right = refitNode(node.right, boundsOf);
  node.bounds = left.union(right);
  return node.bounds;
}
