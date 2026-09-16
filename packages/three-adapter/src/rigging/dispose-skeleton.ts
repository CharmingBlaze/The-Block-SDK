import type { SkinnedMesh } from "three";
import type { ThreeSkeletonResources } from "./create-skeleton";

export function disposeThreeSkeleton(resources: ThreeSkeletonResources, mesh?: SkinnedMesh): void {
  for (const bone of resources.bones) {
    bone.removeFromParent();
    bone.userData = {};
  }
  resources.skeleton.bones.length = 0;
  resources.skeleton.boneInverses.length = 0;
  if (mesh) {
    mesh.bind(resources.skeleton);
    mesh.skeleton.bones.length = 0;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
    } else {
      material.dispose();
    }
  }
}
