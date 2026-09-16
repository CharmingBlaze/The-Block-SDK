import type { Node as GltfNode } from "@gltf-transform/core";
import { addNode } from "@modeling-kit/scene";
import type { SceneNodeType } from "@modeling-kit/document";
import { throwIfAborted } from "../../cancel";
import { matrixHasShear, transformFromTrs } from "../conversion/matrices";
import type { GltfImportContext } from "./import-context";
import { importMesh } from "./import-mesh";
import { bindSkinToMesh } from "./import-skin";

export function importNode(context: GltfImportContext, node: GltfNode, parentId: string): void {
  throwIfAborted(context.options.signal, "glTF import");
  if (context.objectByNode.has(node)) {
    return;
  }
  const objectId = context.ids.object();
  context.objectByNode.set(node, objectId);
  const gltfMesh = node.getMesh();
  const importedMesh = gltfMesh ? importMesh(context, gltfMesh) : undefined;
  const isJoint = context.boneByNode.has(node);
  const type: SceneNodeType = importedMesh ? "mesh_instance" : isJoint ? "bone" : node.getCamera() ? "camera" : "group";
  const matrix = node.getMatrix();
  if (matrixHasShear(matrix)) {
    context.sink.loss("matrix-shear-lost", `Node '${node.getName()}' matrix contains shear that was decomposed to TRS`, {
      affectedObject: objectId,
      suggestedCorrection: "Author TRS without shear",
    });
  }
  const extras = node.getExtras() as Record<string, unknown> | null;
  addNode(context.document, objectId, {
    name: node.getName() || "Node",
    type,
    parentId: parentId as never,
    localTransform: transformFromTrs(node.getTranslation(), node.getRotation(), node.getScale()),
    ...(importedMesh ? { payloadRef: importedMesh.meshId } : {}),
    ...(isJoint ? { metadata: { boneId: context.boneByNode.get(node), role: "joint" } } : {}),
  });
  if (extras?.visible === false) {
    const stored = context.document.scene.nodes.get(objectId);
    if (stored) {
      context.document.scene.nodes.set(objectId, { ...stored, visible: false });
    }
  }
  const skin = node.getSkin();
  if (skin && importedMesh && context.options.importSkins) {
    bindSkinToMesh(context, skin, importedMesh.meshId);
  }
  for (const child of node.listChildren()) {
    importNode(context, child, objectId);
  }
}
