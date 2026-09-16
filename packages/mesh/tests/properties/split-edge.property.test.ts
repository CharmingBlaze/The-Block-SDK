import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { createMeshOperationContext, splitEdge } from "../../src/index";
import { closedCube } from "./generators";
import { assertClosedManifold, assertUnchangedOnThrow } from "./invariants";

describe("property: splitEdge", () => {
  it("rejects t outside (0, 1) and leaves the mesh unchanged", () => {
    assert(
      property(
        double({ min: -4, max: 5, noNaN: true, noDefaultInfinity: true }).filter((t) => t <= 0 || t >= 1),
        (t) => {
          const { mesh, ids } = closedCube("prop-split-invalid", 1);
          const edgeId = [...mesh.edges.keys()][0]!;
          const ctx = createMeshOperationContext(ids);
          assertUnchangedOnThrow(mesh, () => splitEdge(mesh, { edgeId, t }, ctx));
        },
      ),
      { numRuns: 40 },
    );
  });

  it("inserts a vertex on a cube edge and keeps a closed manifold", () => {
    assert(
      property(double({ min: Math.fround(0.05), max: Math.fround(0.95), noNaN: true }), (t) => {
        const { mesh, ids } = closedCube("prop-split-valid", 1);
        const edgeId = [...mesh.edges.keys()][0]!;
        const ctx = createMeshOperationContext(ids);
        const result = splitEdge(mesh, { edgeId, t }, ctx);
        expect(result.newVertexId).toBeDefined();
        expect(mesh.vertices.size).toBe(9);
        assertClosedManifold(mesh);
      }),
      { numRuns: 25 },
    );
  });
});
