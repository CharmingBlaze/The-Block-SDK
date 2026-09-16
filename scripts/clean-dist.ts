import fs from "node:fs";
import path from "node:path";
import { listPackageDirs, repoRoot } from "./lib/workspace.ts";

function rmDist(dir: string): void {
  const dist = path.join(dir, "dist");
  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
  }
}

for (const dir of listPackageDirs()) {
  rmDist(dir);
}

const apps = path.join(repoRoot, "apps");
if (fs.existsSync(apps)) {
  for (const entry of fs.readdirSync(apps, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      rmDist(path.join(apps, entry.name));
    }
  }
}

console.log("clean:dist removed package and app dist directories");
