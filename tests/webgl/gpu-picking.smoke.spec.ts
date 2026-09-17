import { expect, test } from "@playwright/test";

const REQUIRED_CASES = [
  "perspective-object",
  "perspective-face",
  "repeated-click",
  "empty-click",
  "overlapping-front-wins",
  "quad-canonical-face",
  "front-only-backface-miss",
  "front-and-back-hit",
  "orthographic-object",
  "dpr-2",
  "canvas-offset",
  "split-viewport-pixel",
  "split-viewport-pick",
  "camera-view-offset-restored",
  "maximized-viewport",
  "resize-invalidation",
  "render-mode-solid",
  "render-mode-material",
  "render-mode-textured",
  "render-mode-unlit",
  "render-mode-wireframe",
  "render-mode-shaded-wireframe",
  "render-mode-normals",
  "render-mode-uv-checker",
  "render-mode-game-preview",
  "static-shadow-map",
] as const;

test("real WebGL GPU picking smoke", async ({ page }) => {
  await page.goto("/");
  const report = await page.waitForFunction(() => window.__GPU_PICK_SMOKE__);
  const value = await report.jsonValue();
  if (!value || typeof value !== "object") {
    throw new Error("WEBGL_UNAVAILABLE: smoke harness did not publish a report");
  }
  if ("error" in value) {
    throw new Error(String(value.error));
  }
  expect(value.webglCreated).toBe(true);
  const byName = new Map(value.cases.map((item) => [item.name, item]));
  const missing = REQUIRED_CASES.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing smoke cases: ${missing.join(", ")}`);
  }
  const failed = REQUIRED_CASES.filter((name) => byName.get(name)?.ok !== true);
  expect(failed, JSON.stringify([...byName.values()].filter((item) => !item.ok))).toEqual([]);
});
