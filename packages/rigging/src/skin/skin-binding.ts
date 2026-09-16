import type { BoneId } from "@modeling-kit/core";
import { Matrix4 } from "@modeling-kit/math";
import type { InverseBindMatrix, MeshSkinBinding } from "@modeling-kit/document";
import type { MeshSkinningData } from "../types";

export function skinFromBinding(binding: MeshSkinBinding): MeshSkinningData {
  const weights = new Map(binding.vertices.map((entry) => [entry.vertexId, entry.influences] as const));
  const inverseBindMatrices = matricesFromEntries(binding.inverseBindMatrices);
  return {
    skeletonId: binding.skeletonId,
    maxInfluences: binding.maxInfluences,
    weights,
    ...(inverseBindMatrices ? { inverseBindMatrices } : {}),
  };
}

export function skinToBinding(skin: MeshSkinningData): MeshSkinBinding {
  const vertices = [...skin.weights.entries()].map(([vertexId, influences]) => ({
    vertexId,
    influences,
  }));
  vertices.sort((a, b) => a.vertexId.localeCompare(b.vertexId));
  const inverseBindMatrices = entriesFromMatrices(skin.inverseBindMatrices);
  return {
    skeletonId: skin.skeletonId,
    maxInfluences: skin.maxInfluences,
    vertices,
    ...(inverseBindMatrices ? { inverseBindMatrices } : {}),
  };
}

function matricesFromEntries(
  entries: readonly InverseBindMatrix[] | undefined,
): Map<BoneId, Matrix4> | undefined {
  if (!entries) {
    return undefined;
  }
  const matrices = new Map<BoneId, Matrix4>();
  for (const entry of entries) {
    matrices.set(entry.boneId, new Matrix4([...entry.matrix]));
  }
  return matrices;
}

function entriesFromMatrices(
  matrices: ReadonlyMap<BoneId, Matrix4> | undefined,
): InverseBindMatrix[] | undefined {
  if (!matrices) {
    return undefined;
  }
  const entries = [...matrices.entries()].map(([boneId, matrix]) => ({
    boneId,
    matrix: [...matrix.elements],
  }));
  entries.sort((a, b) => a.boneId.localeCompare(b.boneId));
  return entries;
}
