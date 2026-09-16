import { createSequenceIdFactory } from "@modeling-kit/core";
import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { MeshBuilder, createMeshOperationContext, mergeVerticesByDistance } from "../../src/index";
import { closedCube } from "./generators";
import { assertClosedManifold, assertUnchangedOnThrow } from "./invariants";

describe("property: weld / mergeVerticesByDistance", () => {
  it("rejects non-positive epsilon without mutating the mesh", () => {
    assert(
      property(
        double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }).filter((epsilon) => epsilon <= 0),
        (epsilon) => {
          const { mesh, ids } = closedCube("prop-weld-invalid", 1);
          const ctx = createMeshOperationContext(ids);
          assertUnchangedOnThrow(mesh, () => mergeVerticesByDistance(mesh, epsilon, ctx));
        },
      ),
      { numRuns: 25 },
    );
  });

  it("does not weld a cube when epsilon is smaller than the edge length", () => {
    assert(
      property(double({ min: Math.fround(1e-6), max: Math.fround(0.4), noNaN: true }), (epsilon) => {
        const { mesh, ids } = closedCube("prop-weld-cube", 1);
        const ctx = createMeshOperationContext(ids);
        const result = mergeVerticesByDistance(mesh, epsilon, ctx);
        expect(result.mergedCount).toBe(0);
        expect(mesh.vertices.size).toBe(8);
        assertClosedManifold(mesh);
      }),
      { numRuns: 20 },
    );
  });

  it("welds a near-coincident unused vertex into the nearby corner", () => {
    assert(
      property(double({ min: Math.fround(1e-5), max: Math.fround(1e-3), noNaN: true }), (delta) => {
        const ids = createSequenceIdFactory("prop-weld-close");
        const ctx = createMeshOperationContext(ids);
        const builder = new MeshBuilder(ids.mesh());
        const a = builder.addVertex(0, 0, 0);
        const b = builder.addVertex(1, 0, 0);
        const c = builder.addVertex(0, 1, 0);
        builder.addVertex(delta, 0, 0);
        builder.addFace([a, b, c]);
        const mesh = builder.getMesh();
        const result = mergeVerticesByDistance(mesh, 0.01, ctx);
        expect(result.mergedCount).toBeGreaterThanOrEqual(1);
        expect(mesh.vertices.size).toBe(3);
      }),
      { numRuns: 20 },
    );
  });
});
