import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot, toPosix } from "./lib/workspace.ts";

interface Options {
  taskPath: string;
  changedFiles: string[];
  allowDeps: boolean;
  strictApi: boolean;
}

function parseArgs(argv: string[]): Options {
  let taskPath = "";
  let allowDeps = false;
  let strictApi = false;
  const changedFiles: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--task") {
      taskPath = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--changed-files") {
      i += 1;
      while (i < argv.length && !argv[i]!.startsWith("--")) {
        changedFiles.push(argv[i]!);
        i += 1;
      }
      i -= 1;
    } else if (arg === "--allow-deps") {
      allowDeps = true;
    } else if (arg === "--strict-api") {
      strictApi = true;
    }
  }
  if (!taskPath) {
    const branch = git("rev-parse --abbrev-ref HEAD") ?? "";
    const match = branch.match(/agent\/([A-Z0-9-]+)/i);
    if (match?.[1]) {
      const candidate = path.join(repoRoot, "tasks", `${match[1]}.md`);
      if (fs.existsSync(candidate)) {
        taskPath = candidate;
      }
    }
  }
  if (!taskPath) {
    throw new Error("Pass --task path/to/task.md (or run on branch agent/<TASK-ID>).");
  }
  return {
    taskPath: path.isAbsolute(taskPath) ? taskPath : path.join(repoRoot, taskPath),
    changedFiles,
    allowDeps,
    strictApi,
  };
}

function git(command: string): string | undefined {
  try {
    return execSync(`git ${command}`, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

function sectionList(markdown: string, heading: string): string[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`));
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) =>
      line
        .slice(2)
        .replace(/`/g, "")
        .replace(/\s*\(.*\)\s*$/, "")
        .trim(),
    )
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("everything else"));
}

function gitChangedFiles(): string[] {
  if (!git("rev-parse --verify HEAD")) {
    return [];
  }
  const names = git("diff --name-only --diff-filter=ACMRD HEAD");
  const untracked = git("ls-files --others --exclude-standard");
  return [...new Set([...(names ? names.split("\n") : []), ...(untracked ? untracked.split("\n") : [])])].filter(
    Boolean,
  );
}

function normalize(file: string): string {
  return file.split(path.sep).join("/");
}

function isAllowed(file: string, allowed: string[]): boolean {
  const rel = normalize(file);
  return allowed.some((pattern) => {
    const clean = normalize(pattern);
    if (clean.endsWith("/**")) {
      return rel.startsWith(clean.slice(0, -3));
    }
    return rel === clean;
  });
}

function hasRequirementIds(markdown: string): boolean {
  return /\b[A-Z]{2,}(?:-[A-Z0-9]+)*-\d{3}\b/.test(markdown);
}

const options = parseArgs(process.argv.slice(2));
if (!fs.existsSync(options.taskPath)) {
  console.error(`Task file missing: ${options.taskPath}`);
  process.exit(1);
}

const markdown = fs.readFileSync(options.taskPath, "utf8");
const errors: string[] = [];
const warnings: string[] = [];

if (!hasRequirementIds(markdown)) {
  errors.push("Task has no requirement IDs (expected e.g. MESH-005).");
}

const allowed = sectionList(markdown, "Allowed files");
if (allowed.length === 0) {
  errors.push("Task does not declare Allowed files.");
}

const forbidden = sectionList(markdown, "Forbidden files");
if (!/pnpm exec vitest|pnpm test|vitest run/.test(markdown)) {
  errors.push("Task is missing verification commands (expected vitest/pnpm test).");
}

const changed = (options.changedFiles.length > 0 ? options.changedFiles : gitChangedFiles()).map(normalize);
if (changed.length === 0) {
  warnings.push("No changed files supplied and git diff is empty. Pass --changed-files for a dry run.");
}

for (const file of changed) {
  if (allowed.length > 0 && !isAllowed(file, allowed)) {
    errors.push(`Out of scope: ${file}`);
  }
  if (forbidden.some((item) => item !== "Everything else" && isAllowed(file, [item]))) {
    errors.push(`Forbidden file changed: ${file}`);
  }
}

const depTouched = changed.some(
  (file) =>
    file.endsWith("package.json") ||
    file.endsWith("pnpm-lock.yaml") ||
    file.endsWith("pnpm-workspace.yaml"),
);
if (depTouched && !options.allowDeps && !/allow(ed)? dependencies/i.test(markdown)) {
  errors.push("Dependency manifests changed without task approval or --allow-deps.");
}

const apiTouched = changed.some((file) => /packages\/[^/]+\/src\/index\.ts$/.test(file));
if (apiTouched) {
  const message = "Public entry file changed; Cursor must review API surface.";
  if (options.strictApi) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}

console.log(`task: ${toPosix(options.taskPath)}`);
console.log(`changed: ${changed.join(", ") || "(none)"}`);
for (const warning of warnings) {
  console.warn(`warn: ${warning}`);
}
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}
console.log("check-agent-task: ok");
