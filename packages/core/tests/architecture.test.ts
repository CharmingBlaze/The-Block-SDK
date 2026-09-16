import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { brand, type MeshId, type ObjectId } from "../src/index";

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_CODECS = [
  /\.bbmodel\b/i,
  /\bmolang\b/i,
  /\boptifine\b/i,
  /\.jem\b/i,
  /\.jpm\b/i,
  /\bgeckolib\b/i,
  /\bbedrock\s+geometry\b/i,
];

const FORBIDDEN_DEPENDENCIES = [
  "three-mesh-bvh",
  "manifold-3d",
  "opencascade.js",
  "gl-matrix",
  "@gltf-transform/core",
  "comlink",
  "meshoptimizer",
];

const ALLOWED_OPTIONAL_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  mesh: ["earcut"],
  math: ["robust-predicates"],
  primitives: ["primitive-geometry"],
};

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(path, out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("architecture gates", () => {
  it("does not ship game-format codecs in package sources", () => {
    const hits: string[] = [];
    for (const pkg of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!pkg.isDirectory()) {
        continue;
      }
      const src = join(packagesRoot, pkg.name, "src");
      if (!existsSync(src)) {
        continue;
      }
      for (const file of walkTsFiles(src)) {
        const text = readFileSync(file, "utf8");
        for (const pattern of FORBIDDEN_CODECS) {
          if (pattern.test(text)) {
            hits.push(`${file} matches ${pattern}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps branded IDs as strings, never render indices", () => {
    const objectId = brand<string, "ObjectId">("obj-live");
    const meshId = brand<string, "MeshId">("mesh-live");
    const asObject: ObjectId = objectId;
    const asMesh: MeshId = meshId;
    expect(typeof asObject).toBe("string");
    expect(typeof asMesh).toBe("string");
    expect(asObject.includes("obj-")).toBe(true);
    expect(asMesh.includes("mesh-")).toBe(true);
  });

  it("does not install forbidden geometry libraries", () => {
    const found: string[] = [];
    for (const pkg of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!pkg.isDirectory()) {
        continue;
      }
      const manifestPath = join(packagesRoot, pkg.name, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      for (const name of FORBIDDEN_DEPENDENCIES) {
        if (manifest.dependencies?.[name] || manifest.peerDependencies?.[name]) {
          found.push(`${pkg.name}:${name}`);
        }
      }
      for (const name of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
        const allowed = ALLOWED_OPTIONAL_DEPENDENCIES[pkg.name] ?? [];
        if (
          (name === "earcut" || name === "robust-predicates" || name === "primitive-geometry") &&
          !allowed.includes(name)
        ) {
          found.push(`${pkg.name}:${name}`);
        }
      }
      for (const [allowedPkg, names] of Object.entries(ALLOWED_OPTIONAL_DEPENDENCIES)) {
        for (const name of names) {
          if ((manifest.dependencies?.[name] || manifest.peerDependencies?.[name]) && pkg.name !== allowedPkg) {
            found.push(`${pkg.name}:${name}`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});
