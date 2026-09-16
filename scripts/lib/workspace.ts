import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface PackageManifest {
  readonly dir: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly exports: Record<string, unknown> | string | undefined;
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly private?: boolean;
}

export const PACKAGE_LAYERS: Record<
  string,
  {
    purpose: string;
    layer: string;
    requirementPrefixes: readonly string[];
    forbidden: readonly string[];
  }
> = {
  "@modeling-kit/core": {
    purpose: "Branded IDs, Result, events, lifecycle machines, dirty flags",
    layer: "foundation",
    requirementPrefixes: ["CORE", "ID", "LIFE"],
    forbidden: ["three", "@modeling-kit/three-adapter", "DOM"],
  },
  "@modeling-kit/math": {
    purpose: "Headless vectors, matrices, and geometric helpers",
    layer: "foundation",
    requirementPrefixes: ["MATH"],
    forbidden: ["three", "DOM", "other workspace packages"],
  },
  "@modeling-kit/document": {
    purpose: "Canonical ModelDocument, hierarchy, serialization",
    layer: "document",
    requirementPrefixes: ["DOC", "SER"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/mesh": {
    purpose: "Half-edge kernel and topology operators",
    layer: "kernel",
    requirementPrefixes: ["MESH", "MESH-OP"],
    forbidden: ["tools", "commands", "document", "three", "DOM"],
  },
  "@modeling-kit/validation": {
    purpose: "Mesh invariant checks and healing reports",
    layer: "kernel",
    requirementPrefixes: ["VAL"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/scene": {
    purpose: "Document scene helpers and re-exports",
    layer: "document",
    requirementPrefixes: ["SCENE"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/selection": {
    purpose: "Branded-ID selection and topology grow/shrink",
    layer: "editor",
    requirementPrefixes: ["SEL"],
    forbidden: ["three", "DOM", "commands"],
  },
  "@modeling-kit/history": {
    purpose: "Undo/redo stacks and command manager",
    layer: "editor",
    requirementPrefixes: ["HIST", "CMD"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/materials": {
    purpose: "Material definitions and slots",
    layer: "attributes",
    requirementPrefixes: ["MAT"],
    forbidden: ["three"],
  },
  "@modeling-kit/uv": {
    purpose: "UV islands and 2D editing helpers",
    layer: "attributes",
    requirementPrefixes: ["UV"],
    forbidden: ["three"],
  },
  "@modeling-kit/paint": {
    purpose: "Image/paint revision helpers",
    layer: "attributes",
    requirementPrefixes: ["PAINT"],
    forbidden: ["three"],
  },
  "@modeling-kit/primitives": {
    purpose: "Procedural mesh generators (box, sphere, …)",
    layer: "kernel",
    requirementPrefixes: ["PRIM"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/commands": {
    purpose: "Documented edits, session, fluent editor",
    layer: "editor",
    requirementPrefixes: ["CMD"],
    forbidden: ["three", "DOM"],
  },
  "@modeling-kit/tools": {
    purpose: "Tool state machines and pointer claims",
    layer: "interaction",
    requirementPrefixes: ["TOOL"],
    forbidden: ["three"],
  },
  "@modeling-kit/input": {
    purpose: "Headless actions/gestures; DOM bind is ./dom",
    layer: "interaction",
    requirementPrefixes: ["INP"],
    forbidden: ["three (main entry)"],
  },
  "@modeling-kit/transform": {
    purpose: "Object/component transforms and gizmos data",
    layer: "editor",
    requirementPrefixes: ["XFORM"],
    forbidden: ["three"],
  },
  "@modeling-kit/snapping": {
    purpose: "Snap queries and tolerances",
    layer: "editor",
    requirementPrefixes: ["SNAP"],
    forbidden: ["three"],
  },
  "@modeling-kit/formats": {
    purpose: "glTF/OBJ/STL/PLY interchange via glTF Transform",
    layer: "io",
    requirementPrefixes: ["FMT"],
    forbidden: ["three"],
  },
  "@modeling-kit/workers": {
    purpose: "Async job boundaries for heavy mesh work",
    layer: "io",
    requirementPrefixes: ["JOB"],
    forbidden: ["three", "DOM in the runtime-neutral entry"],
  },
  "@modeling-kit/meshopt": {
    purpose: "Optional meshoptimizer adapter on derived triangles only",
    layer: "io",
    requirementPrefixes: ["JOB"],
    forbidden: ["three", "canonical mesh mutation"],
  },
  "@modeling-kit/rigging": {
    purpose: "Canonical skeletons, skins, inverse binds, and weight validation",
    layer: "editor",
    requirementPrefixes: ["RIG"],
    forbidden: ["three"],
  },
  "@modeling-kit/animation": {
    purpose: "Canonical clips, tracks, and renderer-neutral evaluation",
    layer: "editor",
    requirementPrefixes: ["ANIM"],
    forbidden: ["three"],
  },
  "@modeling-kit/three-adapter": {
    purpose: "Derived Three.js viewport, picking, overlays",
    layer: "adapter",
    requirementPrefixes: ["VP", "ARCH"],
    forbidden: ["canonical mesh mutation"],
  },
  "@modeling-kit/sdk": {
    purpose: "Host facade; currently pulls three-adapter (ARCH-003)",
    layer: "facade",
    requirementPrefixes: ["SDK", "ARCH"],
    forbidden: ["new runtime engines without provenance"],
  },
};

export function listPackageDirs(): string[] {
  const root = path.join(repoRoot, "packages");
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
    .sort();
}

export function readManifest(dir: string): PackageManifest {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
    name: string;
    version?: string;
    description?: string;
    exports?: Record<string, unknown> | string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    private?: boolean;
  };
  return {
    dir,
    name: raw.name,
    version: raw.version ?? "0.0.0",
    description: raw.description ?? "",
    exports: raw.exports,
    dependencies: raw.dependencies ?? {},
    peerDependencies: raw.peerDependencies ?? {},
    private: raw.private,
  };
}

export function exportEntryPaths(manifest: PackageManifest): string[] {
  const exportsField = manifest.exports;
  if (!exportsField) {
    const fallback = path.join(manifest.dir, "src/index.ts");
    return fs.existsSync(fallback) ? [fallback] : [];
  }
  if (typeof exportsField === "string") {
    return [path.join(manifest.dir, exportsField)];
  }
  const files: string[] = [];
  for (const spec of Object.values(exportsField)) {
    if (spec && typeof spec === "object" && "import" in spec) {
      const importPath = (spec as { import?: string }).import;
      if (importPath) {
        files.push(path.join(manifest.dir, importPath));
      }
    }
  }
  return files.filter((file) => fs.existsSync(file));
}

export function workspaceDeps(manifest: PackageManifest): string[] {
  return Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies })
    .filter(([, version]) => version.startsWith("workspace:"))
    .map(([name]) => name)
    .sort();
}

export function toPosix(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}
