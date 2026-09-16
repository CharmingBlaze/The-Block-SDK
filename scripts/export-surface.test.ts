import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectExportFiles,
  pairedDeclaration,
  requiredPackedFiles,
  tarballContains,
} from "./lib/export-files.ts";
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

describe("packed export file resolution", () => {
  it("collects nested Node/browser conditions and pairs JS with declarations", () => {
    const refs = collectExportFiles({
      ".": {
        types: "./dist/index.d.ts",
        browser: "./dist/browser.js",
        node: {
          types: "./dist/node.d.ts",
          import: "./dist/node.js",
          default: "./dist/node.js",
        },
        import: "./dist/index.js",
      },
      "./browser": {
        types: "./dist/browser.d.ts",
        import: "./dist/browser.js",
      },
    });
    expect(requiredPackedFiles(refs)).toEqual([
      "./dist/browser.d.ts",
      "./dist/browser.js",
      "./dist/index.d.ts",
      "./dist/index.js",
      "./dist/node.d.ts",
      "./dist/node.js",
    ]);
    expect(pairedDeclaration("./dist/index.js")).toBe("./dist/index.d.ts");
  });

  it("rejects require conditions so packages stay ESM-only", () => {
    expect(() =>
      collectExportFiles({ ".": { require: "./dist/index.cjs", import: "./dist/index.js" } }),
    ).toThrow(/require/);
  });

  it("matches npm pack package/ prefixes", () => {
    expect(tarballContains(["package/dist/index.js", "package/package.json"], "./dist/index.js")).toBe(true);
    expect(tarballContains(["package/dist/index.js"], "./dist/missing.js")).toBe(false);
  });
});
