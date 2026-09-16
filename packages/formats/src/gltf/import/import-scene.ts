import { addNode } from "@modeling-kit/scene";
import { importNode } from "./import-node";
import type { GltfImportContext } from "./import-context";

export function importScenes(context: GltfImportContext): void {
  const root = context.source.getRoot();
  const scenes = root.listScenes();
  const defaultScene = root.getDefaultScene() ?? scenes[0];
  if (scenes.length > 1) {
    context.sink.warn("multiple-scenes", `Imported ${scenes.length} scenes; default scene roots are document roots`);
  }
  const ordered = defaultScene ? [defaultScene, ...scenes.filter((scene) => scene !== defaultScene)] : scenes;
  for (const scene of ordered) {
    for (const node of scene.listChildren()) {
      importNode(context, node, context.document.scene.rootNodeId);
    }
  }
  if (context.objectByNode.size === 0 && context.meshes.size > 0) {
    for (const meshId of context.meshes.keys()) {
      addNode(context.document, context.ids.object(), {
        name: context.document.meshes.get(meshId)?.name ?? "Mesh",
        type: "mesh_instance",
        payloadRef: meshId,
      });
    }
  }
}
