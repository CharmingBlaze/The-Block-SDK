import type { MeshSkinBinding } from "@modeling-kit/document";
import type { MeshSkinningData } from "./types";

export function skinFromBinding(binding: MeshSkinBinding): MeshSkinningData {
  const weights = new Map(
    binding.vertices.map((entry) => [entry.vertexId, entry.influences] as const),
  );
  return {
    skeletonId: binding.skeletonId,
    maxInfluences: binding.maxInfluences,
    weights,
  };
}

export function skinToBinding(skin: MeshSkinningData): MeshSkinBinding {
  const vertices = [...skin.weights.entries()].map(([vertexId, influences]) => ({
    vertexId,
    influences,
  }));
  vertices.sort((a, b) => a.vertexId.localeCompare(b.vertexId));
  return {
    skeletonId: skin.skeletonId,
    maxInfluences: skin.maxInfluences,
    vertices,
  };
}
