import fs from "node:fs";
import path from "node:path";
import { listPackageDirs, readManifest, repoRoot, toPosix } from "./lib/workspace.ts";

const REQUIREMENT_ID = /\b[A-Z]{2,}(?:-[A-Z0-9]+)*-\d{3}\b/g;

function collectTests(dir: string): string[] {
  const testsDir = path.join(dir, "tests");
  if (!fs.existsSync(testsDir)) {
    return [];
  }
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".test.ts")) {
        out.push(full);
      }
    }
  };
  walk(testsDir);
  return out.sort();
}

function classify(file: string): string {
  if (file.includes(".property.test.ts")) {
    return "property";
  }
  if (file.includes("benchmark")) {
    return "benchmark";
  }
  if (file.includes("integration")) {
    return "integration";
  }
  return "unit";
}

const lines: string[] = [
  "# Test index",
  "",
  "Generated from `packages/*/tests`. Pass/fail is `not-run` at generation time; use `pnpm test` for live status.",
  "",
  "| Package | File | Type | Requirement IDs | Invariant hints | Status |",
  "| ------- | ---- | ---- | --------------- | --------------- | ------ |",
];

for (const dir of listPackageDirs()) {
  const manifest = readManifest(dir);
  for (const file of collectTests(dir)) {
    const source = fs.readFileSync(file, "utf8");
    const ids = [...new Set(source.match(REQUIREMENT_ID) ?? [])].sort();
    const describes = [...source.matchAll(/\b(?:it|describe)\(\s*["'`]([^"'`]+)["'`]/g)]
      .map((match) => match[1])
      .slice(0, 4);
    lines.push(
      `| ${manifest.name} | \`${toPosix(file)}\` | ${classify(file)} | ${ids.join(", ") || "—"} | ${describes.join("; ") || "—"} | not-run |`,
    );
  }
}

lines.push("");

fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "generated/test-index.md"), `${lines.join("\n")}\n`);
console.log("wrote generated/test-index.md");
