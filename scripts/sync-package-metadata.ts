import fs from "node:fs";
import path from "node:path";
import { listPackageDirs, readManifest, toPosix } from "./lib/workspace.ts";
import { publicationFields } from "./lib/publication.ts";

const checkOnly = process.argv.includes("--check");
let failed = 0;

for (const dir of listPackageDirs()) {
  const manifest = readManifest(dir);
  if (manifest.private) {
    continue;
  }
  const file = path.join(dir, "package.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const directory = toPosix(dir).replace(/\\/g, "/");
  const fields = publicationFields(manifest.name, directory);
  if (checkOnly) {
    for (const [key, expected] of Object.entries(fields)) {
      if (JSON.stringify(raw[key]) !== JSON.stringify(expected)) {
        console.error(`${manifest.name}: ${key} is not standardized`);
        failed += 1;
      }
    }
    continue;
  }
  const next: Record<string, unknown> = { ...raw, ...fields };
  if (typeof raw.description === "string" && raw.description.length > 0 && !fields.description) {
    next.description = raw.description;
  }
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}

if (checkOnly && failed > 0) {
  process.exitCode = 1;
} else if (!checkOnly) {
  console.log("updated package publication metadata");
}
