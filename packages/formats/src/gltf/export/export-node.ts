import type { SceneNode } from "@modeling-kit/document";
import type { ObjectId } from "@modeling-kit/core";
import type { GltfExportContext } from "./export-context";
import { exportMesh } from "./export-mesh";

export function exportNode(context: GltfExportContext, node: SceneNode) {
  const existing = context.nodeByObject.get(node.id);
  if (existing) {
    return existing;
  }
  const gltfNode = context.target.createNode(node.name);
  const t = node.localTransform;
  gltfNode.setTranslation([t.position.x, t.position.y, t.position.z]);
  gltfNode.setRotation([t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w]);
  gltfNode.setScale([t.scale.x, t.scale.y, t.scale.z]);
  if (!node.visible) {
    gltfNode.setExtras({ visible: false });
  }
  const meshId = node.payloadRef;
  if ((node.type === "mesh_instance" || node.type === "mesh") && meshId) {
    const kernel = context.meshes.get(meshId);
    const gltfMesh = context.meshById.get(meshId) ?? (kernel ? exportMesh(context, meshId, kernel) : undefined);
    if (gltfMesh) {
      gltfNode.setMesh(gltfMesh);
    }
  }
  const boneId = typeof node.metadata.boneId === "string" ? node.metadata.boneId : node.payloadRef;
  if (node.type === "bone" && boneId) {
    context.jointNodeByBone.set(boneId, gltfNode);
  }
  context.nodeByObject.set(node.id as ObjectId, gltfNode);
  return gltfNode;
}
