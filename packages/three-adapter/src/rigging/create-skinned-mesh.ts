import type { VertexId } from "@modeling-kit/core";
import type { MeshSkinningData, Skeleton as CanonicalSkeleton } from "@modeling-kit/rigging";
import { DEFAULT_MAX_BONE_INFLUENCES, normalizeWeights } from "@modeling-kit/rigging";
import { BufferAttribute, type BufferGeometry, MeshStandardMaterial, SkinnedMesh } from "three";
import { createBufferGeometry } from "../geometry";
import { createThreeSkeleton, type ThreeSkeletonResources } from "./create-skeleton";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";

export interface ThreeSkinnedMeshResources {
  readonly mesh: SkinnedMesh;
  readonly skeleton: ThreeSkeletonResources;
}

export function writeSkinAttributes(
  geometry: BufferGeometry,
  vertexIdMap: readonly VertexId[],
  skeleton: ThreeSkeletonResources,
  skin: MeshSkinningData,
  maxInfluences = DEFAULT_MAX_BONE_INFLUENCES,
): void {
  const count = vertexIdMap.length;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const vertexId = vertexIdMap[i]!;
    const normalized = normalizeWeights(skin.weights.get(vertexId) ?? [], Math.min(4, maxInfluences));
    for (let k = 0; k < 4; k += 1) {
      const influence = normalized[k];
      indices[i * 4 + k] = influence ? (skeleton.indexById.get(influence.boneId) ?? 0) : 0;
      weights[i * 4 + k] = influence?.weight ?? 0;
    }
  }
  geometry.setAttribute("skinIndex", new BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(weights, 4));
}

export function createThreeSkinnedMesh(
  mesh: HalfEdgeMesh,
  canonical: CanonicalSkeleton,
  skin: MeshSkinningData,
): ThreeSkinnedMeshResources {
  const derived = createBufferGeometry(mesh);
  const skeleton = createThreeSkeleton(canonical);
  writeSkinAttributes(derived.geometry, derived.mapping.renderVertexToVertex, skeleton, skin);
  const skinned = new SkinnedMesh(derived.geometry, new MeshStandardMaterial());
  skinned.name = mesh.id;
  skinned.userData.mapping = derived.mapping;
  for (const root of skeleton.rootBones) {
    skinned.add(root);
  }
  skinned.bind(skeleton.skeleton);
  skinned.normalizeSkinWeights();
  return { mesh: skinned, skeleton };
}
