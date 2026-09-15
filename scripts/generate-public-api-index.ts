import fs from "node:fs";
import path from "node:path";
import { exportEntryPaths, listPackageDirs, readManifest, repoRoot, toPosix } from "./lib/workspace.ts";

interface ApiItem {
  readonly name: string;
  readonly kind: string;
  readonly file: string;
  readonly deprecated: boolean;
}

function precedingDeprecated(source: string, index: number): boolean {
  const start = Math.max(0, index - 400);
  return /@deprecated\b/.test(source.slice(start, index));
}

function parseEntry(file: string): ApiItem[] {
  const source = fs.readFileSync(file, "utf8");
  const items: ApiItem[] = [];
  const rel = toPosix(file);

  const pushNames = (kind: string, names: string, index: number) => {
    const deprecated = precedingDeprecated(source, index);
    for (const part of names.split(",")) {
      const cleaned = part
        .replace(/^\s*type\s+/, "")
        .replace(/^\s*typeof\s+/, "")
        .trim();
      if (!cleaned) {
        continue;
      }
      const alias = cleaned.split(/\s+as\s+/);
      const name = (alias[1] ?? alias[0] ?? "").trim();
      if (name && name !== "default") {
        items.push({ name, kind, file: rel, deprecated });
      }
    }
  };

  const exportList = /\bexport\s+(type\s+)?\{([^}]+)\}/g;
  for (const match of source.matchAll(exportList)) {
    pushNames(match[1] ? "type" : "export", match[2] ?? "", match.index ?? 0);
  }

  const named =
    /\bexport\s+(?:declare\s+)?(async\s+)?(function|class|const|let|var|enum|interface|type)\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(named)) {
    const kind = match[2] ?? "export";
    const name = match[3];
    if (name) {
      items.push({
        name,
        kind,
        file: rel,
        deprecated: precedingDeprecated(source, match.index ?? 0),
      });
    }
  }

  return items;
}

const lines: string[] = [
  "# Public API index",
  "",
  "Generated from package `exports` entry files. Function bodies are omitted. Refresh with `pnpm repo:api`.",
  "",
];

for (const dir of listPackageDirs()) {
  const manifest = readManifest(dir);
  lines.push(`## ${manifest.name}`);
  lines.push("");
  const entries = exportEntryPaths(manifest);
  if (entries.length === 0) {
    lines.push("_No export files found._");
    lines.push("");
    continue;
  }
  const seen = new Set<string>();
  for (const file of entries) {
    lines.push(`Entry: \`${toPosix(file)}\``);
    lines.push("");
    lines.push("| Name | Kind | Deprecated |");
    lines.push("| ---- | ---- | ---------- |");
    for (const item of parseEntry(file)) {
      const key = `${item.name}:${item.kind}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      lines.push(`| \`${item.name}\` | ${item.kind} | ${item.deprecated ? "yes" : "no"} |`);
    }
    lines.push("");
  }
}

fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "generated/public-api-index.md"), `${lines.join("\n")}\n`);
console.log("wrote generated/public-api-index.md");
