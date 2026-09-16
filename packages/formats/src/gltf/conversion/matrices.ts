import { Matrix4, matrixToTransform, transformToMatrix, type TransformData } from "@modeling-kit/math";
import { nearlyEqual } from "@modeling-kit/math";

export function transformFromTrs(
  translation: readonly number[] | undefined,
  rotation: readonly number[] | undefined,
  scale: readonly number[] | undefined,
): TransformData {
  return {
    position: { x: translation?.[0] ?? 0, y: translation?.[1] ?? 0, z: translation?.[2] ?? 0 },
    rotation: {
      x: rotation?.[0] ?? 0,
      y: rotation?.[1] ?? 0,
      z: rotation?.[2] ?? 0,
      w: rotation?.[3] ?? 1,
    },
    scale: { x: scale?.[0] ?? 1, y: scale?.[1] ?? 1, z: scale?.[2] ?? 1 },
  };
}

export function matrixHasShear(elements: readonly number[], epsilon = 1e-4): boolean {
  if (elements.length !== 16) {
    return false;
  }
  const original = new Matrix4([...elements]);
  const recomposed = transformToMatrix(matrixToTransform(original));
  return original.elements.some((value, index) => !nearlyEqual(value, recomposed.elements[index]!, epsilon));
}

export function transformFromMatrix(elements: readonly number[]): TransformData {
  return matrixToTransform(new Matrix4([...elements]));
}
