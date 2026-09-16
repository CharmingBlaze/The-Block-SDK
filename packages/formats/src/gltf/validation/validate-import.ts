import type { GltfImportContext } from "../import/import-context";
import { isStrict } from "../import/import-context";

export function validateImport(context: GltfImportContext): void {
  if (isStrict(context) && context.sink.losses.some((item) => item.code === "unsupported-primitive-mode")) {
    context.sink.warn("validate-import", "Unsupported primitives were skipped");
  }
}
