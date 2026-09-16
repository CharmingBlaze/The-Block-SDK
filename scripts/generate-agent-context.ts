import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/workspace.ts";

export const CONTEXT_PRESETS: Record<
  string,
  { include: string[]; extraDocs?: string[]; tokenBudget: number }
> = {
  mesh: {
    include: [
      "packages/mesh/src/index.ts",
      "packages/mesh/src/operations/contract.ts",
      "packages/mesh/src/operations/elements.ts",
      "packages/mesh/src/operations/split-edge.ts",
      "packages/mesh/src/internal/topology-mapping-builder.ts",
      "packages/mesh/tests/elements.test.ts",
      "packages/mesh/tests/properties",
      "docs/coordination/CURRENT-MILESTONE.md",
      "docs/coordination/API-FREEZE.md",
      "tasks/R1-T001.md",
    ],
    tokenBudget: 15000,
  },
  "commands-history": {
    include: [
      "packages/commands/**",
      "packages/history/**",
      "packages/selection/src/**",
      "packages/mesh/src/operations/contract.ts",
      "docs/architecture/command-system.md",
      "docs/coordination/API-FREEZE.md",
      "tasks/R1-T003.md",
    ],
    tokenBudget: 25000,
  },
  "input-tools": {
    include: [
      "packages/input/**",
      "packages/tools/**",
      "packages/snapping/**",
      "docs/architecture/input.md",
      "docs/architecture/ownership.md",
      "docs/coordination/API-FREEZE.md",
      "tasks/R1-T005.md",
    ],
    tokenBudget: 20000,
  },
  snapping: {
    include: [
      "packages/snapping/**",
      "packages/tools/src/knife-tool.ts",
      "packages/tools/tests/knife.test.ts",
      "packages/mesh/src/operations/knife/**",
      "docs/coordination/API-FREEZE.md",
      "docs/coordination/CURRENT-MILESTONE.md",
      "tasks/R1-T005.md",
    ],
    tokenBudget: 18000,
  },
  transform: {
    include: [
      "packages/transform/**",
      "packages/core/src/lifecycle.ts",
      "packages/core/tests/lifecycle.test.ts",
      "docs/coordination/API-FREEZE.md",
      "docs/coordination/CURRENT-MILESTONE.md",
      "tasks/R1-T006.md",
    ],
    tokenBudget: 15000,
  },
  "document-scene": {
    include: [
      "packages/document/**",
      "packages/scene/**",
      "packages/core/src/**",
      "docs/architecture/document-model.md",
    ],
    tokenBudget: 20000,
  },
  "three-adapter": {
    include: [
      "packages/three-adapter/**",
      "docs/architecture/three-adapter.md",
      "docs/architecture/dependency-policy.md",
    ],
    tokenBudget: 20000,
  },
  "materials-textures": {
    include: ["packages/materials/**", "packages/document/src/**", "docs/architecture/modeling-operator-specification.md"],
    tokenBudget: 18000,
  },
  uv: {
    include: ["packages/uv/**", "packages/mesh/src/**", "docs/architecture/uv-image-paint-sdk-roadmap.md"],
    tokenBudget: 18000,
  },
  "image-paint": {
    include: ["packages/paint/**", "packages/uv/src/**", "packages/document/src/**"],
    tokenBudget: 18000,
  },
  serialization: {
    include: [
      "packages/document/src/**",
      "packages/formats/**",
      "packages/mesh/src/serialize.ts",
      "docs/architecture/document-model.md",
    ],
    tokenBudget: 20000,
  },
  "release-audit": {
    include: [
      "docs/verification/**",
      "docs/coordination/**",
      "docs/architecture/dependency-policy.md",
      "docs/architecture/sdk-architecture.md",
      "package.json",
      "pnpm-workspace.yaml",
    ],
    tokenBudget: 15000,
  },
};

function parseArgs(argv: string[]): { preset: string; budget?: number } {
  const presetFlag = argv.findIndex((arg) => arg === "--preset");
  const preset = presetFlag >= 0 ? argv[presetFlag + 1] : argv[0];
  if (!preset) {
    throw new Error(`Usage: pnpm repo:context -- --preset <name>\nPresets: ${Object.keys(CONTEXT_PRESETS).join(", ")}`);
  }
  const budgetFlag = argv.findIndex((arg) => arg === "--budget");
  const budget = budgetFlag >= 0 ? Number(argv[budgetFlag + 1]) : undefined;
  return { preset, budget };
}

const { preset, budget } = parseArgs(process.argv.slice(2));
const config = CONTEXT_PRESETS[preset];
if (!config) {
  throw new Error(`Unknown preset "${preset}". Known: ${Object.keys(CONTEXT_PRESETS).join(", ")}`);
}

const tokenBudget = budget ?? config.tokenBudget;
const outFile = path.join(repoRoot, "generated", `context-${preset}.md`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const include = config.include.join(",");
const repomixBin = path.join(repoRoot, "node_modules", "repomix", "bin", "repomix.cjs");
const result = spawnSync(
  process.execPath,
  [
    repomixBin,
    "--style",
    "markdown",
    "--output",
    outFile,
    "--include",
    include,
    "--token-budget",
    String(tokenBudget),
    "--token-count-tree",
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const packed = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";
const tokenLine = packed.split("\n").find((line) => /tokens?/i.test(line)) ?? "";
console.log(`preset=${preset} output=${path.relative(repoRoot, outFile)} budget=${tokenBudget} ${tokenLine}`);
