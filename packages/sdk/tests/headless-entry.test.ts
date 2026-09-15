import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ModelingKit from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));

describe("@modeling-kit/sdk headless facade", () => {
  it("does not import three-adapter from the main entry", () => {
    const source = readFileSync(join(here, "../src/index.ts"), "utf8");
    expect(source).not.toMatch(/@modeling-kit\/three-adapter/);
    expect(source).not.toMatch(/\bfrom ["']three["']/);
    expect((ModelingKit as Record<string, unknown>).createThreeViewport).toBeUndefined();
    expect((ModelingKit as Record<string, unknown>).ThreeViewportAdapter).toBeUndefined();
  });
});
