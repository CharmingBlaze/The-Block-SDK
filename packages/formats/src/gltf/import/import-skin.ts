import type { Skin as GltfSkin } from "@gltf-transform/core";
import type { BoneId, MeshId, SkeletonId } from "@modeling-kit/core";
import {
  createBoneData,
  createSkeletonData,
  type InverseBindMatrix,
  type MeshSkinBinding,
  type VertexSkinData,
} from "@modeling-kit/document";
import { Matrix4 } from "@modeling-kit/math";
import { DEFAULT_MAX_BONE_INFLUENCES, normalizeWeightsWithReport } from "@modeling-kit/rigging";
import { accessorToNumbers } from "../conversion/accessors";
import { transformFromTrs } from "../conversion/matrices";
import type { GltfImportContext } from "./import-context";

function identityMatrix(): number[] {
  return [...Matrix4.identity().elements];
}

export function prepareSkinBones(context: GltfImportContext): void {
  if (!context.options.importSkins) {
    if (context.source.getRoot().listSkins().length > 0) {
      context.sink.loss("metadata-dropped", "glTF skins were not imported");
    }
    return;
  }
  for (const skin of context.source.getRoot().listSkins()) {
    for (const joint of skin.listJoints()) {
      if (!context.boneByNode.has(joint)) {
        context.boneByNode.set(joint, context.ids.bone());
      }
    }
  }
}

export function importSkins(context: GltfImportContext): void {
  if (!context.options.importSkins) {
    return;
  }
  for (const skin of context.source.getRoot().listSkins()) {
    importSkin(context, skin);
  }
}

export function importSkin(context: GltfImportContext, skin: GltfSkin): SkeletonId {
  const existing = context.skeletonBySkin.get(skin);
  if (existing) {
    return existing as SkeletonId;
  }
  const joints = skin.listJoints();
  const ibmAccessor = skin.getInverseBindMatrices();
  const ibmValues = accessorToNumbers(ibmAccessor);
  const usedIdentity = !ibmAccessor;
  if (usedIdentity) {
    context.sink.repair("ibm-identity-default", `Skin '${skin.getName()}' omitted inverse bind matrices; identity is used per glTF`);
  }
  const bones = joints.map((joint) => {
    const parentJoint = joint.getParentNode();
    const parentId = parentJoint && context.boneByNode.has(parentJoint) ? context.boneByNode.get(parentJoint) : null;
    const boneId = context.boneByNode.get(joint) ?? context.ids.bone();
    context.boneByNode.set(joint, boneId);
    return createBoneData(boneId as BoneId, joint.getName() || "Joint", {
      ...(parentId ? { parentId: parentId as BoneId } : {}),
      restTransform: transformFromTrs(joint.getTranslation(), joint.getRotation(), joint.getScale()),
    });
  });
  const skeletonId = context.ids.skeleton();
  context.document.skeletons.set(createSkeletonData(skeletonId, skin.getName() || "Skeleton", bones));
  const jointIds = joints.map((joint) => context.boneByNode.get(joint)!);
  context.skeletonBySkin.set(skin, skeletonId);
  context.jointIndexBySkin.set(skeletonId, jointIds);
  const inverseBindMatrices: InverseBindMatrix[] = jointIds.map((boneId, index) => {
    const offset = index * 16;
    const matrix = ibmValues.length >= offset + 16 ? ibmValues.slice(offset, offset + 16) : identityMatrix();
    return { boneId: boneId as BoneId, matrix };
  });
  context.ibmBySkeleton.set(skeletonId, inverseBindMatrices);
  return skeletonId;
}

export function bindSkinToMesh(context: GltfImportContext, skin: GltfSkin, meshId: MeshId): void {
  const skeletonId = importSkin(context, skin);
  const jointIds = context.jointIndexBySkin.get(skeletonId) ?? [];
  const weights = context.meshSkinWeights.get(meshId);
  const vertices: VertexSkinData[] = [];
  for (const [vertexId, influences] of weights?.weights ?? []) {
    const mapped = influences
      .map((item) => {
        const boneId = jointIds[item.jointIndex];
        return boneId ? { boneId: boneId as BoneId, weight: item.weight } : undefined;
      })
      .filter((item): item is { boneId: BoneId; weight: number } => Boolean(item));
    if (mapped.length === 0) {
      continue;
    }
    const fallback = (jointIds[0] ?? mapped[0]?.boneId) as BoneId | undefined;
    const normalized = normalizeWeightsWithReport(mapped, {
      maxInfluences: DEFAULT_MAX_BONE_INFLUENCES,
      ...(fallback ? { fallbackBoneId: fallback } : {}),
    });
    if (normalized.dropped.length > 0) {
      context.sink.loss("skin-influence-truncated", `Mesh ${meshId} vertex influences reduced to 4`, {
        affectedObject: meshId,
      });
    }
    vertices.push({ vertexId, influences: normalized.influences });
  }
  vertices.sort((a, b) => a.vertexId.localeCompare(b.vertexId));
  const inverseBindMatrices = context.ibmBySkeleton.get(skeletonId);
  const binding: MeshSkinBinding = {
    skeletonId,
    maxInfluences: DEFAULT_MAX_BONE_INFLUENCES,
    vertices,
    ...(inverseBindMatrices ? { inverseBindMatrices } : {}),
  };
  const record = context.document.meshes.get(meshId);
  if (record) {
    context.document.meshes.set({ ...record, skin: binding });
  }
}
