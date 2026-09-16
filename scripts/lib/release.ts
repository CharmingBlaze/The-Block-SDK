import fs from "node:fs";
import path from "node:path";
import { listPackageDirs, readManifest, repoRoot, type PackageManifest } from "./workspace.ts";

export const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export interface ChangesetConfigFile {
  readonly access?: string;
  readonly baseBranch?: string;
  readonly changelog?: string;
  readonly fixed?: readonly (readonly string[])[];
  readonly ignore?: readonly string[];
}

export interface ReleaseIssue {
  readonly code: string;
  readonly message: string;
}

export interface ReleaseCheckResult {
  readonly version: string;
  readonly packages: readonly PackageManifest[];
  readonly issues: readonly ReleaseIssue[];
}

export function parseReleaseTag(ref: string): string {
  const trimmed = ref.trim();
  const tag = trimmed.startsWith("refs/tags/") ? trimmed.slice("refs/tags/".length) : trimmed;
  const match = RELEASE_TAG_PATTERN.exec(tag);
  if (!match) {
    throw new Error(`Release tag must look like v0.1.0 (got ${JSON.stringify(ref)})`);
  }
  return match[1] ?? tag.slice(1);
}

export function resolveReleaseTag(options: {
  readonly explicit?: string | undefined;
  readonly requireTag?: boolean | undefined;
  readonly githubRef?: string | undefined;
  readonly githubRefName?: string | undefined;
}): string | undefined {
  if (options.explicit) {
    return options.explicit;
  }
  const ref = options.githubRef ?? "";
  const name = options.githubRefName;
  if (ref.startsWith("refs/tags/") && name) {
    return name;
  }
  if (options.requireTag && name) {
    return name;
  }
  return undefined;
}

export function listAppDirs(): string[] {
  const root = path.join(repoRoot, "apps");
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
    .sort();
}

export function listPublishablePackages(): PackageManifest[] {
  return listPackageDirs()
    .map((dir) => readManifest(dir))
    .filter((manifest) => manifest.private !== true)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPrivateWorkspaceNames(): string[] {
  return [...listPackageDirs(), ...listAppDirs()]
    .map((dir) => readManifest(dir))
    .filter((manifest) => manifest.private === true)
    .map((manifest) => manifest.name)
    .sort();
}

export function readChangesetConfig(root = repoRoot): ChangesetConfigFile {
  const file = path.join(root, ".changeset", "config.json");
  if (!fs.existsSync(file)) {
    throw new Error("Missing .changeset/config.json");
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ChangesetConfigFile;
}

function publishAccess(dir: string): string | undefined {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
    publishConfig?: { access?: string };
  };
  return pkg.publishConfig?.access;
}

function sameNameSet(actual: readonly string[], expected: readonly string[]): boolean {
  const a = [...actual].sort();
  const b = [...expected].sort();
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

export function checkReleaseState(options: {
  readonly tag?: string | undefined;
  readonly requireTag?: boolean | undefined;
} = {}): ReleaseCheckResult {
  const packages = listPublishablePackages();
  const issues: ReleaseIssue[] = [];
  if (packages.length === 0) {
    issues.push({ code: "no-packages", message: "No public packages found under packages/" });
  }
  const versions = new Set(packages.map((pkg) => pkg.version));
  const version = versions.size === 1 ? (packages[0]?.version ?? "") : "";
  if (versions.size !== 1) {
    issues.push({
      code: "version-drift",
      message: `Public packages must share one version; found ${[...versions].sort().join(", ")}`,
    });
  }
  for (const pkg of packages) {
    const access = publishAccess(pkg.dir);
    if (access !== "public") {
      issues.push({
        code: "publish-access",
        message: `${pkg.name} publishConfig.access must be public`,
      });
    }
  }

  const changeset = readChangesetConfig();
  if (changeset.access !== "public") {
    issues.push({
      code: "changeset-access",
      message: `.changeset/config.json access must be public (got ${JSON.stringify(changeset.access)})`,
    });
  }
  if (changeset.baseBranch !== "main") {
    issues.push({
      code: "changeset-branch",
      message: `.changeset/config.json baseBranch must be main (got ${JSON.stringify(changeset.baseBranch)})`,
    });
  }
  const ignored = new Set(changeset.ignore ?? []);
  for (const name of listPrivateWorkspaceNames()) {
    if (!ignored.has(name)) {
      issues.push({
        code: "changeset-ignore",
        message: `.changeset/config.json ignore must include private package ${name}`,
      });
    }
  }
  const fixedNames = [...new Set((changeset.fixed ?? []).flat())];
  const publicNames = packages.map((pkg) => pkg.name);
  if (!sameNameSet(fixedNames, publicNames)) {
    issues.push({
      code: "changeset-fixed",
      message: `.changeset/config.json fixed must list each public @modeling-kit package once and only those packages`,
    });
  }

  if (options.tag !== undefined || options.requireTag) {
    if (!options.tag) {
      issues.push({ code: "missing-tag", message: "A vX.Y.Z git tag is required to publish" });
    } else {
      try {
        const tagged = parseReleaseTag(options.tag);
        if (version && tagged !== version) {
          issues.push({
            code: "tag-mismatch",
            message: `Tag ${options.tag} does not match package version ${version}`,
          });
        }
      } catch (error) {
        issues.push({
          code: "invalid-tag",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { version, packages, issues };
}

export function formatReleaseIssues(issues: readonly ReleaseIssue[]): string {
  return issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n");
}
