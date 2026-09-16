import type { GltfExportContext } from "./export-context";

export function exportCameras(context: GltfExportContext): void {
  let cameras = 0;
  for (const node of context.document.scene.nodes.values()) {
    if (node.type === "camera") {
      cameras += 1;
    }
  }
  if (cameras > 0) {
    context.sink.warn("cameras", `${cameras} camera node(s) exported as transform nodes without projection parameters`);
  }
}
