/**
 * Fail if Knip reports unused source files. Unused exports/types stay advisory
 * (`pnpm deadcode`). Classified leftovers are listed in knip.json ignoreIssues
 * and docs/verification/knip-inventory.md.
 */
import { execFileSync } from "node:child_process";
import { repoRoot } from "./lib/workspace.ts";

const cli = process.env.npm_execpath;
if (!cli) {
  throw new Error("deadcode:files must be run via pnpm so npm_execpath points at the pnpm CLI");
}
const raw = execFileSync(
  process.execPath,
  [cli, "exec", "knip", "--include", "files", "--reporter", "json", "--no-exit-code"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  },
);
const jsonStart = raw.indexOf("{");
if (jsonStart < 0) {
  throw new Error("knip did not print JSON");
}
const report = JSON.parse(raw.slice(jsonStart)) as {
  readonly issues?: readonly { readonly file?: string }[];
};
const files = (report.issues ?? [])
  .map((issue) => (issue.file ?? "").replaceAll("\\", "/"))
  .filter((file) => file.length > 0)
  .sort();
if (files.length > 0) {
  throw new Error(
    `Unclassified unused files (delete, wire, or record in knip-inventory.md):\n${files.map((file) => `  ${file}`).join("\n")}`,
  );
}
