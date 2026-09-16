import { MeshBuilder, triangulateMesh } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { MeshoptOptimizer, derivedFromTriangulated, optimizeDerivedTriangles } from "../src/index";

describe("derived meshoptimizer adapter", () => {
  it("reorders triangles without mutating the half-edge mesh", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const faces = mesh.faces.size;
    const vertices = mesh.vertices.size;
    const tri = triangulateMesh(mesh);
    const sourceIndices = new Uint32Array(tri.indices);
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
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const tri = triangulateMesh(mesh);
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

  it("cancels an in-flight job before WASM work", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const tri = triangulateMesh(mesh);
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

  it("treats a superseded run as cancelled and accepts the latest revision", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const tri = triangulateMesh(mesh);
    const optimizer = new MeshoptOptimizer();
    const first = optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    const second = optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok).toBe(false);
    if (!a.ok) {
      expect(a.code === "cancelled" || a.code === "stale-revision").toBe(true);
    }
    expect(b.ok).toBe(true);
    const again = await optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    expect(again.ok).toBe(true);
    optimizer.dispose();
    const after = await optimizer.run({ ...derivedFromTriangulated(tri), mode: "reorder" });
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.code).toBe("disposed");
    }
  });
});
