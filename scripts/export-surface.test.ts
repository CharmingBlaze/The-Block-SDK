import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listPackageDirs, readManifest, repoRoot } from "./lib/workspace.ts";

describe("public export surface snapshot", () => {
  it("freezes package.json export keys for every workspace package", () => {
    const expected = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/export-surface.snapshot.json"), "utf8"),
    ) as Record<string, string[]>;
    const actual: Record<string, string[]> = {};
    for (const dir of listPackageDirs()) {
      const pkg = readManifest(dir);
      const exportsField = pkg.exports;
      const keys =
        !exportsField || typeof exportsField === "string" ? ["."] : Object.keys(exportsField).sort();
      actual[pkg.name] = keys;
    }
    expect(actual).toEqual(expected);
  });
});
