import type { ObjectId } from "@modeling-kit/core";
import { exportNode } from "./export-node";
import type { GltfExportContext } from "./export-context";

export function exportScene(context: GltfExportContext) {
  const scene = context.target.createScene(context.document.name);
  context.target.getRoot().setDefaultScene(scene);
  const seen = new Set<ObjectId>();
  const visit = (id: ObjectId): void => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const node = context.document.scene.nodes.get(id);
    if (!node) {
      return;
    }
    const gltfNode = exportNode(context, node);
    for (const childId of node.childIds) {
      visit(childId as ObjectId);
      const child = context.nodeByObject.get(childId as ObjectId);
      if (child) {
        gltfNode.addChild(child);
      }
    }
  };
  const root = context.document.scene.nodes.get(context.document.scene.rootNodeId);
  for (const id of root?.childIds ?? []) {
    visit(id as ObjectId);
    const gltfNode = context.nodeByObject.get(id as ObjectId);
    if (gltfNode) {
      scene.addChild(gltfNode);
    }
  }
  return scene;
}
