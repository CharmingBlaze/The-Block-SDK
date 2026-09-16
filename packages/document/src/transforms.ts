import {
  identityTransform,
  matrixToTransform,
  transformToMatrix,
  Quaternion,
  type Matrix4,
  type TransformData,
  type Vec3,
  type Vector3,
} from "@modeling-kit/math";
import { SingularTransformError } from "@modeling-kit/core";
import type { Transform } from "./scene-node";

export type { Transform };

export function composeTransform(transform: Transform): Matrix4 {
  assertFiniteTransform(transform);
  return transformToMatrix(transform);
}

export function decomposeTransform(matrix: Matrix4): Transform {
  return matrixToTransform(matrix);
}

export function multiplyTransforms(a: Transform, b: Transform): Transform {
  return matrixToTransform(composeTransform(a).multiply(composeTransform(b)));
}

export function invertTransform(transform: Transform): Transform {
  const matrix = composeTransform(transform);
  try {
    return matrixToTransform(matrix.invert());
  } catch {
    throw new SingularTransformError();
  }
}

export function tryInvertTransform(transform: Transform): Transform | undefined {
  try {
    return invertTransform(transform);
  } catch {
    return undefined;
  }
}

export function transformPoint(transform: Transform, point: Vec3): Vector3 {
  return composeTransform(transform).transformPoint(point);
}

export function transformDirection(transform: Transform, direction: Vec3): Vector3 {
  return composeTransform(transform).transformDirection(direction);
}

export function cloneTransform(transform: Transform): Transform {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
}

export function identityLocalTransform(): Transform {
  return identityTransform();
}

export function parentWorldTimesLocal(parentWorld: Matrix4, local: Transform): Matrix4 {
  return parentWorld.multiply(composeTransform(local));
}

export function localFromWorld(parentWorld: Matrix4, world: Matrix4): Transform {
  try {
    return matrixToTransform(parentWorld.invert().multiply(world));
  } catch {
    throw new SingularTransformError("Cannot preserve world transform under a singular parent");
  }
}

export interface TransformIssue {
  readonly code: "NON_FINITE" | "INVALID_QUATERNION" | "INVALID_SCALE";
  readonly message: string;
}

export function validateTransform(transform: TransformData): TransformIssue[] {
  const issues: TransformIssue[] = [];
  const values = [
    transform.position.x,
    transform.position.y,
    transform.position.z,
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
    transform.scale.x,
    transform.scale.y,
    transform.scale.z,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    issues.push({ code: "NON_FINITE", message: "Transform contains a non-finite number" });
    return issues;
  }
  const quat = Quaternion.from(transform.rotation);
  if (quat.lengthSq() < 1e-12) {
    issues.push({ code: "INVALID_QUATERNION", message: "Quaternion has zero length" });
  }
  if (transform.scale.x === 0 || transform.scale.y === 0 || transform.scale.z === 0) {
    issues.push({ code: "INVALID_SCALE", message: "Scale contains a zero axis" });
  }
  return issues;
}

export function normalizeStoredTransform(transform: Transform): Transform {
  const issues = validateTransform(transform);
  if (issues.some((issue) => issue.code === "NON_FINITE" || issue.code === "INVALID_QUATERNION")) {
    throw new RangeError(issues[0]?.message ?? "Invalid transform");
  }
  const rotation = Quaternion.from(transform.rotation).normalize();
  return {
    position: { ...transform.position },
    rotation: rotation.toJSON(),
    scale: { ...transform.scale },
  };
}

function assertFiniteTransform(transform: Transform): void {
  const issues = validateTransform(transform);
  if (issues.length > 0 && issues[0]!.code === "NON_FINITE") {
    throw new RangeError(issues[0]!.message);
  }
}

export { identityTransform, matrixToTransform, transformToMatrix };
