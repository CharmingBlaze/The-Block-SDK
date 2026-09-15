import fs from "node:fs";
import path from "node:path";
import { listPackageDirs, readManifest, repoRoot, workspaceDeps } from "./lib/workspace.ts";

const lines: string[] = [
  "# Package graph",
  "",
  "Generated from workspace manifests (dependencies + peerDependencies with `workspace:`). Refresh with `pnpm repo:map`.",
  "",
  "```text",
];

for (const dir of listPackageDirs()) {
  const manifest = readManifest(dir);
  const deps = workspaceDeps(manifest);
  const peers = Object.entries(manifest.peerDependencies)
    .filter(([, version]) => !version.startsWith("workspace:"))
    .map(([name]) => `${name} (peer)`);
  const right = [...deps, ...peers].join(", ") || "(none)";
  lines.push(`${manifest.name} → ${right}`);
}

lines.push("```");
lines.push("");
lines.push("Source-import rules (including Three.js and layer bans) are enforced by `.dependency-cruiser.cjs` (`pnpm arch:check`).");
lines.push("");

fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "generated/package-graph.md"), `${lines.join("\n")}\n`);
console.log("wrote generated/package-graph.md");
