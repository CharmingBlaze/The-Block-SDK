/** Packed export resolution without publint/attw. */

const FILE_CONDITIONS = new Set(["import", "types", "browser", "node", "default", "module"]);

export type ExportFileRef = {
  readonly subpath: string;
  readonly condition: string;
  readonly file: string;
};

export function collectExportFiles(exportsField: unknown, subpath = "."): ExportFileRef[] {
  if (typeof exportsField === "string") {
    return [{ subpath, condition: "default", file: exportsField }];
  }
  if (!exportsField || typeof exportsField !== "object") {
    return [];
  }
  const refs: ExportFileRef[] = [];
  for (const [key, value] of Object.entries(exportsField as Record<string, unknown>)) {
    if (key.startsWith(".")) {
      refs.push(...collectExportFiles(value, key));
      continue;
    }
    if (key === "require") {
      throw new Error(`${subpath} must not declare a require export (ESM-only packages)`);
    }
    if (typeof value === "string") {
      refs.push({ subpath, condition: key, file: value });
      continue;
    }
    if (FILE_CONDITIONS.has(key) && value && typeof value === "object") {
      refs.push(...collectExportFiles(value, subpath));
    }
  }
  return refs;
}

export function pairedDeclaration(file: string): string | undefined {
  return file.endsWith(".js") ? `${file.slice(0, -3)}.d.ts` : undefined;
}

export function requiredPackedFiles(refs: readonly ExportFileRef[]): string[] {
  const files = new Set<string>();
  for (const ref of refs) {
    files.add(ref.file);
    const dts = pairedDeclaration(ref.file);
    if (dts) {
      files.add(dts);
    }
  }
  return [...files].sort();
}

export function tarballContains(entries: readonly string[], relative: string): boolean {
  const needle = relative.replace(/^\.\//, "").replace(/\\/g, "/");
  return entries.some((entry) => {
    const normalized = entry.replace(/\\/g, "/");
    return normalized === `package/${needle}` || normalized.endsWith(`/${needle}`);
  });
}
