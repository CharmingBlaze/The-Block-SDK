import type { ObjectId } from "@modeling-kit/core";
import type { Object3D } from "three";

export function objectIdFromOverlay(object: Object3D): ObjectId | undefined {
  let current: Object3D | null = object;
  while (current) {
    const id = current.userData.objectId as ObjectId | undefined;
    if (id) {
      return id;
    }
    current = current.parent;
  }
  return undefined;
}
