import { describe, expect, it } from "vitest";
import { triangulateMesh } from "@modeling-kit/mesh";
import { generateGrid } from "@modeling-kit/primitives";
import { createModelDocument, serializeDocument, parseDocument } from "@modeling-kit/document";
import { addNode } from "@modeling-kit/scene";
import { identityTransform } from "@modeling-kit/math";
import { createSequenceIdFactory } from "@modeling-kit/core";

describe("Large-mesh timing samples (not part of pnpm test)", () => {
  it("records triangulation of ~10k vertices", () => {
    const mesh = generateGrid({ width: 1, depth: 1, segmentsX: 100, segmentsZ: 100 }).mesh;
    expect(mesh.vertices.size).toBe(101 * 101);
    const t0 = performance.now();
    const tri = triangulateMesh(mesh);
    const durationMs = performance.now() - t0;
    expect(tri.indices.length).toBe(100 * 100 * 2 * 3);
    expect(tri.positions.every((value) => Number.isFinite(value))).toBe(true);
    if (process.env.BENCHMARK_ASSERT === "1") {
      expect(durationMs).toBeLessThan(4_000);
    }
  });

  it("records triangulation of ~100k vertices", () => {
    const mesh = generateGrid({ width: 1, depth: 1, segmentsX: 316, segmentsZ: 316 }).mesh;
    expect(mesh.vertices.size).toBeGreaterThanOrEqual(100_000);
    const t0 = performance.now();
    const tri = triangulateMesh(mesh);
    const durationMs = performance.now() - t0;
    expect(tri.indices.length).toBe(316 * 316 * 2 * 3);
    expect(tri.positions.every((value) => Number.isFinite(value))).toBe(true);
    if (process.env.BENCHMARK_ASSERT === "1") {
      expect(durationMs).toBeLessThan(30_000);
    }
  }, 60_000);

  it("serializes 1k scene nodes with a stable count", () => {
    const ids = createSequenceIdFactory("nodes");
    const doc = createModelDocument({ ids, name: "ManyNodes" });
    for (let i = 0; i < 1000; i += 1) {
      addNode(doc, ids.object(), {
        name: `n${i}`,
        type: "group",
        localTransform: identityTransform(),
      });
    }
    expect(doc.scene.nodes.size).toBeGreaterThan(1000);
    const serialized = serializeDocument(doc);
    const reloaded = parseDocument(serialized);
    expect(reloaded.scene.nodes.size).toBe(doc.scene.nodes.size);
  });
});
