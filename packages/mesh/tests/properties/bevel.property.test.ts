import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { bevelEdges, createMeshOperationContext } from "../../src/index";
import { closedCube } from "./generators";
import { assertClosedManifold, assertUnchangedOnThrow } from "./invariants";

describe("property: bevelEdges", () => {
  it("rejects non-positive offsets without mutating the mesh", () => {
    assert(
      property(
        double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }).filter((offset) => offset <= 0),
        (offset) => {
          const { mesh, ids } = closedCube("prop-bevel-invalid");
          const edgeId = [...mesh.edges.keys()][0]!;
          const ctx = createMeshOperationContext(ids);
          assertUnchangedOnThrow(mesh, () => bevelEdges(mesh, { edgeIds: [edgeId], offset }, ctx));
        },
      ),
      { numRuns: 25 },
    );
  });

  it("bevels a cube edge and stays a closed manifold", () => {
    assert(
      property(double({ min: Math.fround(0.05), max: Math.fround(0.22), noNaN: true }), (offset) => {
        const { mesh, ids } = closedCube("prop-bevel-valid");
        const edgeId = [...mesh.edges.keys()][0]!;
        const ctx = createMeshOperationContext(ids);
        const result = bevelEdges(mesh, { edgeIds: [edgeId], offset }, ctx);
        expect(result.chamferFaceIds.length).toBeGreaterThanOrEqual(1);
        assertClosedManifold(mesh);
      }),
      { numRuns: 20 },
    );
  });
});
