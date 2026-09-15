import fs from "node:fs";
import path from "node:path";
import { PACKAGE_LAYERS, listPackageDirs, readManifest, repoRoot, toPosix, workspaceDeps } from "./lib/workspace.ts";

function internalDirs(pkgDir: string): string[] {
  const src = path.join(pkgDir, "src");
  if (!fs.existsSync(src)) {
    return [];
  }
  return fs
    .readdirSync(src, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => toPosix(path.join(src, entry.name)))
    .sort();
}

function publicEntries(pkgDir: string, manifestExports: unknown): string[] {
  if (!manifestExports || typeof manifestExports !== "object") {
    const fallback = path.join(pkgDir, "src/index.ts");
    return fs.existsSync(fallback) ? [toPosix(fallback)] : [];
  }
  const keys = Object.keys(manifestExports as Record<string, unknown>).sort();
  return keys.map((key) => `${key === "." ? "." : key}`);
}

const lines: string[] = [
  "# Repository map",
  "",
  "Generated from `packages/*/package.json`. Do not edit by hand. Refresh with `pnpm repo:map`.",
  "",
];

for (const dir of listPackageDirs()) {
  const manifest = readManifest(dir);
  const meta = PACKAGE_LAYERS[manifest.name];
  const testsDir = path.join(dir, "tests");
  lines.push(`## ${manifest.name}`);
  lines.push("");
  lines.push(`- Purpose: ${meta?.purpose ?? (manifest.description || "(see package.json)")}`);
  lines.push(`- Layer: ${meta?.layer ?? "unspecified"}`);
  lines.push(`- Version: ${manifest.version}`);
  lines.push(`- Public entry keys: ${publicEntries(dir, manifest.exports).join(", ") || "(none declared)"}`);
  const internals = internalDirs(dir);
  lines.push(`- Internal directories: ${internals.length > 0 ? internals.join(", ") : "(flat src)"}`);
  lines.push(`- Workspace dependencies: ${workspaceDeps(manifest).join(", ") || "(none)"}`);
  const peers = Object.keys(manifest.peerDependencies);
  if (peers.length > 0) {
    lines.push(`- Peer dependencies: ${peers.join(", ")}`);
  }
  lines.push(`- Forbidden: ${meta?.forbidden.join("; ") ?? "(see dependency-cruiser)"}`);
  lines.push(`- Requirement ID prefixes: ${meta?.requirementPrefixes.join(", ") ?? "(none)"}`);
  lines.push(`- Tests: ${fs.existsSync(testsDir) ? toPosix(testsDir) : "(none)"}`);
  lines.push("");
}

fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "generated/repo-map.md"), `${lines.join("\n")}\n`);
console.log("wrote generated/repo-map.md");
