import { assert, double, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { bridgeLoops, createMeshOperationContext } from "../../src/index";
import { disjointLoops } from "./generators";
import { assertManifoldAllowBoundary, assertUnchangedOnThrow } from "./invariants";

describe("property: bridgeLoops", () => {
  it("rejects unequal loops without mutating the mesh", () => {
    assert(
      property(integer({ min: 3, max: 6 }), (count) => {
        const { mesh, loopA, loopB, ids } = disjointLoops("prop-bridge-invalid", 2);
        const ctx = createMeshOperationContext(ids);
        assertUnchangedOnThrow(mesh, () =>
          bridgeLoops(mesh, { loopA, loopB: loopB.slice(0, Math.min(count, loopB.length - 1)) }, ctx),
        );
      }),
      { numRuns: 20 },
    );
  });

  it("bridges equal boundary loops into a manifold open tube", () => {
    assert(
      property(double({ min: Math.fround(0.5), max: Math.fround(4), noNaN: true }), (gap) => {
        const { mesh, loopA, loopB, ids } = disjointLoops("prop-bridge-valid", gap);
        const ctx = createMeshOperationContext(ids);
        const result = bridgeLoops(mesh, { loopA, loopB }, ctx);
        expect(result.bridgeFaceIds).toHaveLength(4);
        expect(mesh.findBoundaryEdges()).toHaveLength(8);
        assertManifoldAllowBoundary(mesh);
      }),
      { numRuns: 20 },
    );
  });
});
