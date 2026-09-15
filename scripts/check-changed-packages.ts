import { execSync } from "node:child_process";
import path from "node:path";
import { listPackageDirs, repoRoot, toPosix } from "./lib/workspace.ts";

function git(command: string): string | undefined {
  try {
    return execSync(`git ${command}`, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const hasHead = Boolean(git("rev-parse --verify HEAD"));
let files: string[] = [];
if (hasHead) {
  const against = git("merge-base HEAD main") ? "main...HEAD" : "HEAD";
  const diff = git(`diff --name-only ${against}`);
  const untracked = git("ls-files --others --exclude-standard");
  files = [...new Set([...(diff ? diff.split("\n") : []), ...(untracked ? untracked.split("\n") : [])])].filter(Boolean);
} else {
  console.log("No git history yet; all packages are considered changed.");
}

const packageDirs = listPackageDirs();
const changed = hasHead
  ? packageDirs.filter((dir) => {
      const rel = toPosix(dir);
      return files.some((file) => file.replaceAll("\\", "/").startsWith(`${rel}/`));
    })
  : packageDirs;

if (changed.length === 0) {
  console.log("No package source changes detected.");
  process.exit(0);
}

console.log("Changed packages:");
for (const dir of changed) {
  console.log(`- ${path.basename(dir)}`);
}
