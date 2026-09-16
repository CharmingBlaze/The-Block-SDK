import type { GltfExportContext } from "./export-context";

export function exportLights(_context: GltfExportContext): void {
  // Punctual lights are exported when KHR_lights_punctual is enabled on a later slice.
}
