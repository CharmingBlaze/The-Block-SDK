import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MeshBuilder, serializeMesh } from "@modeling-kit/mesh";

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const distNode = path.join(distDir, "node.js");
const distIndex = path.join(distDir, "index.js");

describe("@modeling-kit/workers compiled node worker", () => {
  it("exists as a built entry", () => {
    expect(existsSync(distNode), "dist/node.js missing; run pnpm build first").toBe(true);
    expect(existsSync(distIndex)).toBe(true);
    expect(existsSync(path.join(distDir, "browser.js"))).toBe(true);
    expect(existsSync(path.join(distDir, "browser-worker.js"))).toBe(true);
    expect(existsSync(path.join(distDir, "node-worker.js"))).toBe(true);
  });

  it("triangulates on worker_threads after build", async () => {
    const { AsyncComputePool } = (await import(pathToFileURL(distNode).href)) as {
      AsyncComputePool: new () => {
        backend: string;
        triangulateAsync: (
          mesh: ReturnType<typeof serializeMesh>,
        ) => Promise<{ positions: Float32Array; indices: Uint32Array }>;
        dispose: () => void;
      };
    };
    const pool = new AsyncComputePool();
    expect(pool.backend).toBe("worker-threads");
    const tri = await pool.triangulateAsync(serializeMesh(MeshBuilder.createCube(2, 2, 2)));
    expect(tri.positions.length).toBe(24 * 3);
    expect(tri.indices.length).toBe(12 * 3);
    pool.dispose();
  });

  it("keeps the compiled public entry free of Node worker_threads", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(distIndex, "utf8");
    expect(source).not.toMatch(/node:worker_threads/);
    expect(source).not.toMatch(/\bprocess\b/);
  });
});
