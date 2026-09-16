import { describe, expect, it } from "vitest";
import { automaticUnwrap, projectPlanar } from "../../src/index";
import { cubeMesh } from "./helpers";
import { AsyncComputePool, WorkerPoolUnwrapBackend, createInlineComputePool } from "@modeling-kit/workers";
import { buildUvTriangulation, setUvUnwrapBackend } from "../../src/unwrap";

describe("automatic chart unwrap runtime", () => {
  it("imports the public API in Node without initializing WASM", async () => {
    expect(typeof automaticUnwrap).toBe("function");
    expect(typeof projectPlanar).toBe("function");
    expect(!("window" in globalThis) || (globalThis as { window?: unknown }).window === undefined).toBe(true);
    const backend = new (await import("../../src/unwrap")).XAtlasUnwrapBackend();
    backend.dispose();
    await expect(backend.initialize()).rejects.toMatchObject({ code: "disposed" });
  });

  it("unwraps through the inline compute pool without leaking the public watlas type", async () => {
    const pool = createInlineComputePool();
    setUvUnwrapBackend(new WorkerPoolUnwrapBackend(pool));
    try {
      const mesh = cubeMesh();
      const result = await automaticUnwrap({ mesh, options: { resolution: 128 } });
      expect(result.statistics.triangleCount).toBeGreaterThan(0);
    } finally {
      setUvUnwrapBackend(null);
      pool.dispose();
    }
  });

  it("accepts typed-array unwrap tasks on the inline pool", async () => {
    const mesh = cubeMesh();
    const built = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const pool = new AsyncComputePool({ backend: "inline" });
    try {
      const result = await pool.unwrapUvAsync(built.input, { resolution: 128, padding: 1 });
      expect(result.triangleCount).toBe(built.input.indices.length / 3);
      expect(result.atlasWidth).toBeGreaterThan(0);
    } finally {
      pool.dispose();
    }
  });

  it("rejects unwrap tasks after the compute pool is disposed", async () => {
    const mesh = cubeMesh();
    const built = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const pool = createInlineComputePool();
    pool.dispose();
    await expect(pool.unwrapUvAsync(built.input, { resolution: 64 })).rejects.toThrow(/cancelled/);
  });
});
