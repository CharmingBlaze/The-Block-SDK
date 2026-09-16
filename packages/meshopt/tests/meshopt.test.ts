import { MeshBuilder, triangulateMesh } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { MeshoptOptimizer, derivedFromTriangulated, optimizeDerivedTriangles } from "../src/index";

function cubeBuffers() {
  const mesh = MeshBuilder.createCube(2, 2, 2);
  const tri = triangulateMesh(mesh);
  return { mesh, tri, sourceIndices: new Uint32Array(tri.indices) };
}

describe("derived meshoptimizer adapter", () => {
  it("reorders triangles without mutating the half-edge mesh", async () => {
    const { mesh, tri, sourceIndices } = cubeBuffers();
    const faces = mesh.faces.size;
    const vertices = mesh.vertices.size;
    const result = await optimizeDerivedTriangles(derivedFromTriangulated(tri), { mode: "reorder" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(mesh.faces.size).toBe(faces);
    expect(mesh.vertices.size).toBe(vertices);
    expect([...tri.indices]).toEqual([...sourceIndices]);
    expect(result.primary.indices.length).toBe(tri.indices.length);
    expect(result.primary.mapping.status).toBe("exact");
    expect(result.primary.mapping.triangleFaceIds).toHaveLength(tri.indices.length / 3);
    expect(new Set(result.primary.mapping.triangleFaceIds).size).toBe(faces);
    for (const faceId of result.primary.mapping.triangleFaceIds ?? []) {
      expect(mesh.faces.has(faceId)).toBe(true);
    }
  });

  it("does not claim exact FaceId mapping after LOD simplification", async () => {
    const { mesh, tri } = cubeBuffers();
    const result = await optimizeDerivedTriangles(derivedFromTriangulated(tri), {
      lod: { ratio: 0.5, targetError: 0.1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.primary.mapping.status).not.toBe("exact");
    expect(result.primary.mapping.limitation).toBeDefined();
    expect(result.primary.indices.length).toBeGreaterThan(0);
    expect(result.primary.indices.length).toBeLessThanOrEqual(tri.indices.length);
    expect(mesh.faces.size).toBe(6);
  });

  it("emits extra LOD levels from lodRatios", async () => {
    const { tri } = cubeBuffers();
    const optimizer = new MeshoptOptimizer();
    const result = await optimizer.run({
      ...derivedFromTriangulated(tri),
      mode: "simplify",
      targetIndexRatio: 0.75,
      lodRatios: [0.5],
      targetError: 0.1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lod).toHaveLength(1);
    expect(result.lod[0]?.ratio).toBe(0.5);
    expect(result.lod[0]?.mapping.status).not.toBe("exact");
    optimizer.dispose();
  });

  it("cancels an in-flight job before WASM work", async () => {
    const { tri } = cubeBuffers();
    const controller = new AbortController();
    controller.abort();
    const result = await optimizeDerivedTriangles(derivedFromTriangulated(tri), {
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("cancelled");
    }
  });

  it("rejects over-limit input without calling the backend", async () => {
    const optimizer = new MeshoptOptimizer();
    const result = await optimizer.run(
      {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        mode: "reorder",
      },
      { limits: { maxVertices: 2, maxIndices: 3, maxBytes: 1024, timeoutMs: 1000, minTriangles: 1 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("limit-exceeded");
    }
    optimizer.dispose();
  });

  it("treats a newer run as superseding the previous revision", async () => {
    const { tri } = cubeBuffers();
    const optimizer = new MeshoptOptimizer();
    const first = optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    const second = optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    const [older, newer] = await Promise.all([first, second]);
    expect(older.ok).toBe(false);
    if (!older.ok) {
      expect(["cancelled", "stale-revision"]).toContain(older.code);
    }
    expect(newer.ok).toBe(true);
    optimizer.dispose();
  });

  it("refuses work after dispose", async () => {
    const optimizer = new MeshoptOptimizer();
    optimizer.dispose();
    const result = await optimizer.run({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      mode: "reorder",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("disposed");
    }
  });
});
