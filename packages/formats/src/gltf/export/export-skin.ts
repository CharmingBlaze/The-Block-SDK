import type { SkeletonData } from "@modeling-kit/document";
import { skeletonFromData } from "@modeling-kit/rigging";
import type { GltfExportContext } from "./export-context";

export function exportSkeletonJoints(context: GltfExportContext, skeleton: SkeletonData) {
  const runtime = skeletonFromData(skeleton);
  for (const bone of runtime.bones.values()) {
    if (context.jointNodeByBone.has(bone.id)) {
      continue;
    }
    const node = context.target.createNode(bone.name);
    const t = bone.restTransform;
    node.setTranslation([t.position.x, t.position.y, t.position.z]);
    node.setRotation([t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w]);
    node.setScale([t.scale.x, t.scale.y, t.scale.z]);
    context.jointNodeByBone.set(bone.id, node);
  }
  for (const bone of runtime.bones.values()) {
    const node = context.jointNodeByBone.get(bone.id);
    if (!node || !bone.parentId) {
      continue;
    }
    const parent = context.jointNodeByBone.get(bone.parentId);
    parent?.addChild(node);
  }
  return runtime;
}

export function exportSkins(context: GltfExportContext): void {
  if (!context.options.exportSkins) {
    if (context.document.skeletons.size > 0) {
      context.sink.loss("metadata-dropped", "Skeletons, skins, joints, inverse bind matrices, JOINTS_0, and WEIGHTS_0 are not exported");
    }
    return;
  }
  const buffer = context.target.getRoot().listBuffers()[0] ?? context.target.createBuffer();
  const defaultScene = context.target.getRoot().getDefaultScene();
  for (const skeleton of context.document.skeletons.values()) {
    const runtime = exportSkeletonJoints(context, skeleton);
    const orderedIds = context.jointOrderBySkeleton.get(skeleton.id) ?? [...runtime.bones.keys()];
    const joints = orderedIds
      .map((id) => runtime.bones.get(id as never))
      .filter((bone): bone is NonNullable<typeof bone> => Boolean(bone));
    const ibm: number[] = [];
    const meshBinding = [...context.document.meshes.values()].find((mesh) => mesh.skin?.skeletonId === skeleton.id)?.skin;
    for (const bone of joints) {
      const authored = meshBinding?.inverseBindMatrices?.find((entry) => entry.boneId === bone.id);
      const matrix = authored ? authored.matrix : bone.inverseBindMatrix.elements;
      ibm.push(...matrix);
      const node = context.jointNodeByBone.get(bone.id);
      if (!node) {
        context.sink.loss("metadata-dropped", `Joint '${bone.name}' has no valid node`);
      }
    }
    const ibmAccessor = context.target
      .createAccessor()
      .setType("MAT4")
      .setArray(new Float32Array(ibm))
      .setBuffer(buffer);
    const skin = context.target.createSkin(skeleton.name).setInverseBindMatrices(ibmAccessor);
    for (const bone of joints) {
      const node = context.jointNodeByBone.get(bone.id);
      if (node) {
        skin.addJoint(node);
      }
    }
    const root = runtime.rootBoneIds[0];
    if (root) {
      const rootNode = context.jointNodeByBone.get(root);
      if (rootNode) {
        skin.setSkeleton(rootNode);
        if (defaultScene && !rootNode.getParentNode() && !defaultScene.listChildren().includes(rootNode)) {
          defaultScene.addChild(rootNode);
        }
      }
    }
    for (const [objectId, node] of context.nodeByObject) {
      const sceneNode = context.document.scene.nodes.get(objectId);
      const meshId = sceneNode?.payloadRef;
      const record = meshId ? context.document.meshes.get(meshId as never) : undefined;
      if (record?.skin?.skeletonId === skeleton.id) {
        node.setSkin(skin);
      }
    }
  }
}
