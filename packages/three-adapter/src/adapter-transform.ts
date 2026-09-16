import { brand } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import type { SceneNode } from "@modeling-kit/document";
import type { Object3D } from "three";

export function resolveDisplayTransform(
  session: ModelingSession,
  node: SceneNode,
): SceneNode["localTransform"] {
  if (node.type === "bone" && node.payloadRef) {
    const posed = session.poseLocals.get(brand<string, "BoneId">(node.payloadRef));
    if (posed) {
      return posed;
    }
  }
  const objectPose = session.objectPoseLocals.get(node.id);
  if (objectPose) {
    return objectPose;
  }
  return node.localTransform;
}

export function applyLocalTransform(object: Object3D, transform: SceneNode["localTransform"]): void {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.quaternion.set(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
  );
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}
