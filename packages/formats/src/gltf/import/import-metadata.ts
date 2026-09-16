import type { GltfImportContext } from "./import-context";

const SUPPORTED_EXTENSIONS = new Set([
  "KHR_materials_unlit",
  "KHR_materials_emissive_strength",
  "KHR_texture_transform",
  "KHR_lights_punctual",
  "KHR_node_visibility",
  "EXT_texture_webp",
]);

export function importMetadata(context: GltfImportContext): void {
  const root = context.source.getRoot();
  const used = root.listExtensionsUsed().map((extension) => extension.extensionName);
  const required = root.listExtensionsRequired().map((extension) => extension.extensionName);
  const unknown = used.filter((name) => !SUPPORTED_EXTENSIONS.has(name));
  if (unknown.length > 0) {
    for (const name of unknown) {
      context.sink.loss("unsupported-extension", `glTF extension '${name}' is not represented in the SDK material/scene model`, {
        sourcePath: "extensionsUsed",
        suggestedCorrection: "Preserve the original glTF if this extension is required",
      });
    }
    if (context.options.preserveUnknownExtensions) {
      context.document.metadata.gltfExtensionsUsed = used;
      context.document.metadata.gltfExtensionsRequired = required;
    }
  }
  const extras = root.getExtras();
  if (extras && Object.keys(extras).length > 0) {
    context.document.metadata.gltfExtras = extras;
  }
}
