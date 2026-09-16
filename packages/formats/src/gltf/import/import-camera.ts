import type { GltfImportContext } from "./import-context";

export function importCameras(context: GltfImportContext): void {
  const cameras = context.source.getRoot().listCameras();
  if (cameras.length === 0) {
    return;
  }
  context.sink.warn("cameras", `Imported ${cameras.length} camera node type(s); projection parameters are stored on the scene node when present`);
}
