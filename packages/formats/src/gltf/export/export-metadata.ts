import type { GltfExportContext } from "./export-context";

export function exportMetadata(context: GltfExportContext): void {
  const extras = context.document.metadata.gltfExtras;
  if (extras && typeof extras === "object") {
    context.target.getRoot().setExtras(extras as Record<string, unknown>);
  }
}
