import { describe, expect, it } from "vitest";
import { MeshBuilder, serializeMesh } from "@modeling-kit/mesh";
import { projectBoxUv } from "@modeling-kit/uv";
import { AsyncComputePool, defaultComputePool } from "../src/index";

describe("@modeling-kit/workers", () => {
  it("asynchronously triangulates a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);

    const pool = new AsyncComputePool();
    const tri = await pool.triangulateAsync(serialized);

    expect(tri.positions.length).toBe(24 * 3);
    expect(tri.indices.length).toBe(12 * 3);
  });

  it("asynchronously packs UVs on a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    projectBoxUv(mesh);
    const serialized = serializeMesh(mesh);

    const pool = new AsyncComputePool();
    const result = await pool.packUvsAsync(serialized, { padding: 0.01 });

    expect(result.corners.length).toBe(serialized.corners.length);
  });

  it("asynchronously validates a serialized mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const serialized = serializeMesh(mesh);

    const result = await defaultComputePool.validateAsync(serialized);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statistics.faceCount).toBe(6);
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
    expect(pool.objectUrls.disposed).toBe(true);
  });
});
