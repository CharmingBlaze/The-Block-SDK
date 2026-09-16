/**
 * Pack public packages and prove a clean consumer can import compiled dist.
 *
 * Checks:
 * 1. package.json files/exports point at dist, not src
 * 2. `pnpm pack` tarballs contain dist JS + types and omit src
 * 3. Headless packages install into a clean Node ESM fixture and import
 * 4. `@modeling-kit/sdk` dist does not import `three`
 * 5. Optional Three.js entry is `@modeling-kit/sdk/three` only
 * 6. Nested workspace versions resolve through local tarball overrides
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listPackageDirs, readManifest, repoRoot } from "./lib/workspace.ts";
import { NODE_ENGINE, PACKAGE_LICENSE } from "./lib/publication.ts";

const HEADLESS_IMPORTS: Record<string, readonly string[]> = {
  "@modeling-kit/core": ["@modeling-kit/core"],
  "@modeling-kit/math": ["@modeling-kit/math"],
  "@modeling-kit/document": ["@modeling-kit/document"],
  "@modeling-kit/mesh": ["@modeling-kit/mesh"],
  "@modeling-kit/selection": ["@modeling-kit/selection"],
  "@modeling-kit/history": ["@modeling-kit/history"],
  "@modeling-kit/animation": ["@modeling-kit/animation"],
  "@modeling-kit/sdk": ["@modeling-kit/sdk"],
  "@modeling-kit/workers": ["@modeling-kit/workers", "@modeling-kit/workers/node"],
  "@modeling-kit/meshopt": ["@modeling-kit/meshopt"],
  "@modeling-kit/uv": ["@modeling-kit/uv"],
};

function runPnpm(args: string[], cwd: string): string {
  const cli = process.env.npm_execpath;
  if (!cli) {
    fail("pack:verify must be run via pnpm so npm_execpath points at the pnpm CLI");
  }
  try {
    return execFileSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: "utf8",
      env: process.env,
    });
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const detail = (err.stderr || err.stdout || err.message || "").trim();
    fail(`pnpm ${args.join(" ")} failed in ${cwd}${detail ? `\n${detail}` : ""}`);
  }
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

function assertExportPath(name: string, subpath: string, kind: string, value: unknown): void {
  if (typeof value === "string" && !value.startsWith("./dist/")) {
    fail(`${name} export ${subpath} ${kind} must point at ./dist/`);
  }
}

function assertExportSpec(name: string, subpath: string, spec: unknown): void {
  if (typeof spec === "string") {
    assertExportPath(name, subpath, "path", spec);
    return;
  }
  if (!spec || typeof spec !== "object") {
    return;
  }
  const entry = spec as Record<string, unknown>;
  assertExportPath(name, subpath, "import", entry.import);
  assertExportPath(name, subpath, "types", entry.types);
  assertExportPath(name, subpath, "browser", entry.browser);
  assertExportPath(name, subpath, "node", entry.node);
  for (const [condition, nested] of Object.entries(entry)) {
    if (condition === "import" || condition === "types" || condition === "browser" || condition === "default") {
      continue;
    }
    assertExportSpec(name, `${subpath} [${condition}]`, nested);
  }
}

function assertPublicationMetadata(pkg: Record<string, unknown>): void {
  const name = String(pkg.name);
  if (pkg.license !== PACKAGE_LICENSE) {
    fail(`${name}: license must be ${PACKAGE_LICENSE}`);
  }
  if (!pkg.repository || typeof pkg.repository !== "object") {
    fail(`${name}: missing repository metadata`);
  }
  if (typeof pkg.homepage !== "string" || pkg.homepage.length === 0) {
    fail(`${name}: missing homepage`);
  }
  if (!pkg.bugs || typeof pkg.bugs !== "object") {
    fail(`${name}: missing bugs metadata`);
  }
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length === 0) {
    fail(`${name}: missing keywords`);
  }
  const engines = pkg.engines as { node?: unknown } | undefined;
  if (engines?.node !== NODE_ENGINE) {
    fail(`${name}: engines.node must be ${NODE_ENGINE}`);
  }
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
    assertExportSpec(name, subpath, spec);
  }
  assertPublicationMetadata(pkg);
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
  if (name === "@modeling-kit/workers") {
    for (const required of [
      "dist/index.js",
      "dist/browser.js",
      "dist/node.js",
      "dist/browser-worker.js",
      "dist/node-worker.js",
    ]) {
      if (!normalized.some((entry) => entry.endsWith(`/${required}`) || entry.endsWith(required))) {
        fail(`${name}: tarball missing ${required}`);
      }
    }
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

function assertWorkersPublicDistIsRuntimeNeutral(workersDir: string): void {
  const index = path.join(workersDir, "dist", "index.js");
  if (!fs.existsSync(index)) {
    fail("@modeling-kit/workers: dist/index.js missing; run pnpm build first");
  }
  const source = fs.readFileSync(index, "utf8");
  if (source.includes("node:worker_threads") || /\bprocess\b/.test(source)) {
    fail("@modeling-kit/workers dist/index.js must not reference Node worker_threads or process");
  }
}

function verifyPackedConsumer(
  work: string,
  packages: ReadonlyArray<{ dir: string; manifest: ReturnType<typeof readManifest> }>,
): void {
  const tarballDir = path.join(work, "tarballs");
  fs.mkdirSync(tarballDir);

  for (const item of packages) {
    runPnpm(["pack", "--pack-destination", tarballDir], item.dir);
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
  const overrides: Record<string, string> = {};
  for (const item of packages) {
    const spec = `file:${path
      .join(tarballDir, tarballName(item.manifest.name, item.manifest.version))
      .replace(/\\/g, "/")}`;
    overrides[item.manifest.name] = spec;
    if (item.manifest.name === "@modeling-kit/three-adapter") {
      continue;
    }
    dependencies[item.manifest.name] = spec;
  }
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    JSON.stringify(
      {
        name: "pack-verify-fixture",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    ),
  );
  const overrideLines = Object.entries(overrides)
    .map(([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`)
    .join("\n");
  fs.writeFileSync(
    path.join(fixture, "pnpm-workspace.yaml"),
    ["ignoreWorkspaceRootCheck: true", "linkWorkspacePackages: false", "overrides:", overrideLines, ""].join("\n"),
  );
  runPnpm(["install"], fixture);

  const importer = path.join(fixture, "import.mjs");
  const lines = [
    "const loaded = [];",
    "const { MeshBuilder, serializeMesh } = await import('@modeling-kit/mesh');",
    "const { automaticUnwrap } = await import('@modeling-kit/uv');",
    "const workers = await import('@modeling-kit/workers');",
    "const pool = new workers.AsyncComputePool();",
    "if (pool.backend !== 'worker-threads') { throw new Error(`expected worker-threads, got ${pool.backend}`); }",
    "const tri = await pool.triangulateAsync(serializeMesh(MeshBuilder.createCube(1, 1, 1)));",
    "if (tri.indices.length !== 36) { throw new Error('packed worker triangulation failed'); }",
    "const unwrapped = await automaticUnwrap({ mesh: MeshBuilder.createCube(1, 1, 1) });",
    "if (unwrapped.cornerUvs.size === 0) { throw new Error('packed automatic unwrap failed'); }",
    "pool.dispose();",
    "loaded.push(['@modeling-kit/workers#node-task', 1]);",
    "loaded.push(['@modeling-kit/uv#automatic-unwrap', unwrapped.cornerUvs.size]);",
  ];
  for (const [pkg, specifiers] of Object.entries(HEADLESS_IMPORTS)) {
    for (const specifier of specifiers) {
      lines.push(
        `loaded.push(await import(${JSON.stringify(specifier)}).then((m) => [${JSON.stringify(pkg)}, Object.keys(m).length]));`,
      );
    }
  }
  lines.push("if (loaded.some((item) => item[1] === 0)) { throw new Error('empty export'); }");
  lines.push("console.log(JSON.stringify(loaded));");
  fs.writeFileSync(importer, lines.join("\n"));
  const output = execFileSync(process.execPath, [importer], { cwd: fixture, encoding: "utf8" });
  const parsed = JSON.parse(output.trim()) as Array<[string, number]>;
  if (parsed.length === 0) {
    fail("fixture imported nothing");
  }

  console.log(`pack:verify ok (${packages.length} packages, ${parsed.length} fixture imports)`);
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
  const workers = packages.find((item) => item.manifest.name === "@modeling-kit/workers");
  if (workers) {
    assertWorkersPublicDistIsRuntimeNeutral(workers.dir);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "modeling-kit-pack-verify-"));
  try {
    verifyPackedConsumer(work, packages);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
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
