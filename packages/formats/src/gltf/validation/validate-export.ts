import type { GltfExportContext } from "../export/export-context";

export function validateExport(context: GltfExportContext): void {
  if (context.target.getRoot().listMeshes().length === 0 && context.meshes.size > 0) {
    context.sink.warn("validate-export", "No meshes were written; empty kernels are skipped");
  }
}
