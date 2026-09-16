import type { VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MeshSkinningData, PoseMap, Skeleton } from "../types";
import { evaluateSkinMatrices } from "./skin-matrices";

export function skinPositions(
  mesh: HalfEdgeMesh,
  skeleton: Skeleton,
  skin: MeshSkinningData,
  localPose?: PoseMap,
): Map<VertexId, Vector3> {
  const skinMatrices = evaluateSkinMatrices(skeleton, skin, localPose);
  const result = new Map<VertexId, Vector3>();
  for (const [vertexId, vertex] of mesh.vertices) {
    const rest = new Vector3(vertex.position[0], vertex.position[1], vertex.position[2]);
    const influences = skin.weights.get(vertexId) ?? [];
    if (influences.length === 0) {
      result.set(vertexId, rest);
      continue;
    }
    let x = 0;
    let y = 0;
    let z = 0;
    let weightSum = 0;
    for (const influence of influences) {
      const matrix = skinMatrices.get(influence.boneId);
      if (!matrix) {
        continue;
      }
      const skinned = matrix.transformPoint(rest);
      x += skinned.x * influence.weight;
      y += skinned.y * influence.weight;
      z += skinned.z * influence.weight;
      weightSum += influence.weight;
    }
    if (weightSum <= 1e-8) {
      result.set(vertexId, rest);
      continue;
    }
    const inv = 1 / weightSum;
    result.set(vertexId, new Vector3(x * inv, y * inv, z * inv));
  }
  return result;
}
