import type { GltfImportContext } from "./import-context";

export function importLights(context: GltfImportContext): void {
  const used = context.source
    .getRoot()
    .listExtensionsUsed()
    .some((extension) => extension.extensionName === "KHR_lights_punctual");
  if (used) {
    context.sink.warn("lights", "KHR_lights_punctual is registered; light nodes use scene node light fields when present");
  }
}
