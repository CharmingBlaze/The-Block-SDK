import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MeshBuilder, serializeMesh } from "@modeling-kit/mesh";
import { projectBoxUv } from "@modeling-kit/uv";
import { AsyncComputePool, createInlineComputePool } from "../src/index";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

describe("@modeling-kit/workers", () => {
  it("asynchronously triangulates a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);

    const pool = createInlineComputePool();
    expect(pool.backend).toBe("inline");
    const tri = await pool.triangulateAsync(serialized);

    expect(tri.positions.length).toBe(24 * 3);
    expect(tri.indices.length).toBe(12 * 3);
    pool.dispose();
  });

  it("asynchronously packs UVs on a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    projectBoxUv(mesh);
    const serialized = serializeMesh(mesh);

    const pool = new AsyncComputePool();
    const result = await pool.packUvsAsync(serialized, { padding: 0.01 });

    expect(result.corners.length).toBe(serialized.corners.length);
    pool.dispose();
  });

  it("asynchronously validates a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);

    const pool = createInlineComputePool();
    const result = await pool.validateAsync(serialized);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statistics.faceCount).toBe(6);
    pool.dispose();
  });

  it("cancels in-flight work on abort and dispose without hanging", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);
    const pool = new AsyncComputePool();
    const controller = new AbortController();
    controller.abort();
    await expect(pool.triangulateAsync(serialized, controller.signal)).rejects.toThrow(/cancelled/);
    const pending = pool.triangulateAsync(serialized);
    pool.dispose();
    await expect(pending).rejects.toThrow(/cancelled/);
    pool.dispose();
  });

  it("preserves the original request id when disposing pending work", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);
    const pool = new AsyncComputePool({ backend: "inline" });
    const pending = pool.dispatch({
      id: "keep-me",
      task: { type: "validate", payload: { serializedMesh: serialized } },
    });
    pool.dispose();
    const response = await pending;
    expect(response.id).toBe("keep-me");
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error).toBe("cancelled");
    }
  });

  it("rejects Node and browser backends on the runtime-neutral entry", () => {
    expect(() => new AsyncComputePool({ backend: "worker-threads" })).toThrow(/workers\/node/);
    expect(() => new AsyncComputePool({ backend: "browser-worker" })).toThrow(/workers\/browser/);
  });

  it("keeps the public source entry free of Node modules and globals", () => {
    const publicFiles = [
      "index.ts",
      "pool.ts",
      "compute-task.ts",
      "types.ts",
      "transfer.ts",
      "backend.ts",
      "inline-backend.ts",
    ];
    for (const file of publicFiles) {
      const text = readFileSync(path.join(srcDir, file), "utf8");
      expect(text, file).not.toMatch(/node:worker_threads/);
      expect(text, file).not.toMatch(/\bprocess\b/);
      expect(text, file).not.toMatch(/from ["']node:/);
    }
    expect(existsSync(path.join(srcDir, "browser.ts"))).toBe(true);
    expect(existsSync(path.join(srcDir, "node.ts"))).toBe(true);
  });
});
