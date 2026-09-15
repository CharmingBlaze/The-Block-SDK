import { Matrix4 } from "./mat4";
import { Quaternion, type Quat } from "./quat";
import { Vector3, type Vec3 } from "./vec3";

export interface TransformData {
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly scale: Vec3;
}

export const identityTransform = (): TransformData => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

export function transformToMatrix(transform: TransformData): Matrix4 {
  return Matrix4.compose(
    Vector3.from(transform.position),
    Quaternion.from(transform.rotation),
    Vector3.from(transform.scale),
  );
}

export function matrixToTransform(matrix: Matrix4): TransformData {
  const { position, rotation, scale } = matrix.decompose();
  return {
    position: position.toJSON(),
    rotation: rotation.toJSON(),
    scale: scale.toJSON(),
  };
}
