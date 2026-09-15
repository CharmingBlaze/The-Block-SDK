/**
 * Pack public packages and prove a clean consumer can import compiled dist.
 *
 * Checks:
 * 1. package.json files/exports point at dist, not src
 * 2. `pnpm pack` tarballs contain dist JS + types and omit src
 * 3. Headless packages install into a clean Node ESM fixture and import
 * 4. `@modeling-kit/sdk` dist does not import `three`
 * 5. Optional Three.js entry is `@modeling-kit/sdk/three` only
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listPackageDirs, readManifest, repoRoot } from "./lib/workspace.ts";

const HEADLESS_IMPORTS: Record<string, readonly string[]> = {
  "@modeling-kit/core": ["@modeling-kit/core"],
  "@modeling-kit/math": ["@modeling-kit/math"],
  "@modeling-kit/document": ["@modeling-kit/document"],
  "@modeling-kit/mesh": ["@modeling-kit/mesh"],
  "@modeling-kit/selection": ["@modeling-kit/selection"],
  "@modeling-kit/history": ["@modeling-kit/history"],
  "@modeling-kit/animation": ["@modeling-kit/animation"],
  "@modeling-kit/sdk": ["@modeling-kit/sdk"],
};

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(`${command} ${args.join(" ")} failed in ${cwd}${detail ? `\n${detail}` : ""}`);
  }
  return result.stdout ?? "";
}

function fail(message: string): never {
  throw new Error(message);
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

function tarballName(name: string, version: string): string {
  return `${name.replace("@", "").replace("/", "-")}-${version}.tgz`;
}

function listTarball(file: string): string[] {
  const output = execFileSync("tar", ["-tf", file], { encoding: "utf8" });
  return output.split(/\r?\n/).filter(Boolean);
}

function assertPackageLayout(dir: string): void {
  const pkg = readJson(path.join(dir, "package.json"));
  const name = String(pkg.name);
  const files = pkg.files;
  if (!Array.isArray(files) || !files.includes("dist")) {
    fail(`${name}: files must include "dist"`);
  }
  if (files.includes("src")) {
    fail(`${name}: packed files must not include src`);
  }
  const exportsField = pkg.exports;
  if (!exportsField || typeof exportsField !== "object") {
    fail(`${name}: missing exports map`);
  }
  for (const [subpath, spec] of Object.entries(exportsField as Record<string, unknown>)) {
    if (!spec || typeof spec !== "object") {
      continue;
    }
    const entry = spec as { import?: unknown; types?: unknown };
    if (typeof entry.import === "string" && !entry.import.startsWith("./dist/")) {
      fail(`${name} export ${subpath} import must point at ./dist/`);
    }
    if (typeof entry.types === "string" && !entry.types.startsWith("./dist/")) {
      fail(`${name} export ${subpath} types must point at ./dist/`);
    }
  }
}

function assertTarballContents(name: string, entries: string[]): void {
  const normalized = entries.map((entry) => entry.replace(/\\/g, "/"));
  const hasJs = normalized.some((entry) => /\/dist\/.+\.js$/.test(entry));
  const hasDts = normalized.some((entry) => /\/dist\/.+\.d\.ts$/.test(entry));
  if (!hasJs) {
    fail(`${name}: tarball missing dist JavaScript`);
  }
  if (!hasDts) {
    fail(`${name}: tarball missing dist types`);
  }
  if (normalized.some((entry) => /\/src\/.+\.ts$/.test(entry) && !entry.includes(".d.ts"))) {
    fail(`${name}: tarball includes TypeScript sources`);
  }
}

function assertSdkDoesNotImportThree(sdkDir: string): void {
  const dist = path.join(sdkDir, "dist");
  if (!fs.existsSync(dist)) {
    fail("@modeling-kit/sdk: dist missing; run pnpm build first");
  }
  const files = fs.readdirSync(dist).filter((file) => file.endsWith(".js") && !file.startsWith("three"));
  for (const file of files) {
    const source = fs.readFileSync(path.join(dist, file), "utf8");
    if (/\bfrom\s*["']three["']/.test(source) || /\bfrom\s*["']three\//.test(source)) {
      fail(`@modeling-kit/sdk ${file} must not import three; use @modeling-kit/sdk/three`);
    }
  }
}

function main(): void {
  const packages = listPackageDirs()
    .map((dir) => ({ dir, manifest: readManifest(dir) }))
    .filter((item) => item.manifest.private !== true);

  for (const item of packages) {
    assertPackageLayout(item.dir);
  }
  const sdk = packages.find((item) => item.manifest.name === "@modeling-kit/sdk");
  if (sdk) {
    assertSdkDoesNotImportThree(sdk.dir);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "modeling-kit-pack-verify-"));
  const tarballDir = path.join(work, "tarballs");
  fs.mkdirSync(tarballDir);

  for (const item of packages) {
    run("pnpm", ["pack", "--pack-destination", tarballDir], item.dir);
    const packed = path.join(tarballDir, tarballName(item.manifest.name, item.manifest.version));
    if (!fs.existsSync(packed)) {
      const found = fs.readdirSync(tarballDir).filter((file) => file.endsWith(".tgz"));
      fail(`${item.manifest.name}: expected ${path.basename(packed)}, found ${found.join(", ")}`);
    }
    assertTarballContents(item.manifest.name, listTarball(packed));
  }

  const fixture = path.join(work, "fixture");
  fs.mkdirSync(fixture);
  const dependencies: Record<string, string> = {};
  for (const item of packages) {
    if (item.manifest.name === "@modeling-kit/three-adapter") {
      continue;
    }
    dependencies[item.manifest.name] = `file:${path
      .join(tarballDir, tarballName(item.manifest.name, item.manifest.version))
      .replace(/\\/g, "/")}`;
  }
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    JSON.stringify({ name: "pack-verify-fixture", private: true, type: "module", dependencies }, null, 2),
  );
  run("pnpm", ["install"], fixture);

  const importer = path.join(fixture, "import.mjs");
  const lines = ["const loaded = [];"];
  for (const [pkg, specifiers] of Object.entries(HEADLESS_IMPORTS)) {
    for (const specifier of specifiers) {
      lines.push(`loaded.push(await import(${JSON.stringify(specifier)}).then((m) => [${JSON.stringify(pkg)}, Object.keys(m).length]));`);
    }
  }
  lines.push("if (loaded.some((item) => item[1] === 0)) { throw new Error('empty export'); }");
  lines.push("console.log(JSON.stringify(loaded));");
  fs.writeFileSync(importer, lines.join("\n"));
  const output = execFileSync("node", [importer], { cwd: fixture, encoding: "utf8" });
  const parsed = JSON.parse(output.trim()) as Array<[string, number]>;
  if (parsed.length === 0) {
    fail("fixture imported nothing");
  }

  fs.rmSync(work, { recursive: true, force: true });
  console.log(`pack:verify ok (${packages.length} packages, ${parsed.length} fixture imports)`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pack:verify failed: ${message}`);
  if (error instanceof Error && "stderr" in error && typeof error.stderr === "string" && error.stderr) {
    console.error(error.stderr);
  }
  process.exitCode = 1;
}

void repoRoot;
