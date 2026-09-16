import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkReleaseState,
  parseReleaseTag,
  resolveReleaseTag,
} from "./lib/release.ts";
import { repoRoot } from "./lib/workspace.ts";

describe("release tag parsing", () => {
  it("accepts v-prefixed semver and strips refs/tags/", () => {
    expect(parseReleaseTag("v0.1.0")).toBe("0.1.0");
    expect(parseReleaseTag("refs/tags/v1.2.3")).toBe("1.2.3");
    expect(parseReleaseTag("v1.0.0-rc.1")).toBe("1.0.0-rc.1");
  });

  it("rejects tags without a v prefix or incomplete versions", () => {
    expect(() => parseReleaseTag("0.1.0")).toThrow(/v0\.1\.0/);
    expect(() => parseReleaseTag("v0.1")).toThrow(/v0\.1\.0/);
    expect(() => parseReleaseTag("main")).toThrow(/v0\.1\.0/);
  });

  it("reads GitHub tag refs and ignores branch names unless required", () => {
    expect(
      resolveReleaseTag({
        githubRef: "refs/tags/v0.1.0",
        githubRefName: "v0.1.0",
      }),
    ).toBe("v0.1.0");
    expect(
      resolveReleaseTag({
        githubRef: "refs/heads/main",
        githubRefName: "main",
      }),
    ).toBeUndefined();
    expect(
      resolveReleaseTag({
        requireTag: true,
        githubRefName: "v0.2.0",
      }),
    ).toBe("v0.2.0");
  });
});

describe("release check against this repo", () => {
  it("keeps public packages on one version with public Changesets access", () => {
    const result = checkReleaseState();
    expect(result.issues).toEqual([]);
    expect(result.version).toBe("0.1.0");
    expect(result.packages.length).toBeGreaterThan(1);
    expect(result.packages.every((pkg) => pkg.version === "0.1.0")).toBe(true);
  });

  it("accepts a matching v0.1.0 tag and rejects a mismatch", () => {
    expect(checkReleaseState({ tag: "v0.1.0", requireTag: true }).issues).toEqual([]);
    expect(checkReleaseState({ tag: "v9.9.9", requireTag: true }).issues.map((issue) => issue.code)).toContain(
      "tag-mismatch",
    );
    expect(checkReleaseState({ requireTag: true }).issues.map((issue) => issue.code)).toContain("missing-tag");
  });

  it("maps @modeling-kit/formats to source so clean typecheck does not need dist", () => {
    const tsconfig = JSON.parse(readFileSync(path.join(repoRoot, "tsconfig.base.json"), "utf8")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths["@modeling-kit/formats"]).toEqual([
      "./packages/formats/src/index.ts",
    ]);
    expect(checkReleaseState().issues.filter((issue) => issue.code === "typecheck-path")).toEqual([]);
  });

  it("publishes only from a v* tag workflow", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
    expect(workflow).toMatch(/tags:\s*\n\s*-\s*"v\*"/);
    expect(workflow).toContain("pnpm release:check --require-tag");
    expect(workflow).toContain("pnpm check:release");
    expect(workflow).toContain("pnpm release:publish");
    expect(workflow).toContain("secrets.NPM_TOKEN");
    const ci = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("branches:");
    expect(ci).not.toMatch(/on:\s*\n\s*push:\s*\n\s*pull_request:/);
  });
});
