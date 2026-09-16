import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { createMeshOperationContext, dissolveEdge } from "../../src/index";
import { closedCube, openQuad } from "./generators";
import { assertClosedManifold, assertUnchangedOnThrow } from "./invariants";

describe("property: dissolveEdge", () => {
  it("rejects boundary edges without mutating the mesh", () => {
    assert(
      property(integer({ min: 0, max: 3 }), (index) => {
        const { mesh, ids } = openQuad("prop-dissolve-boundary");
        const edgeId = mesh.findBoundaryEdges()[index]!;
        const ctx = createMeshOperationContext(ids);
        assertUnchangedOnThrow(mesh, () => dissolveEdge(mesh, { edgeId }, ctx));
      }),
      { numRuns: 16 },
    );
  });

  it("dissolves an interior cube edge and stays closed", () => {
    assert(
      property(integer({ min: 0, max: 11 }), (index) => {
        const { mesh, ids } = closedCube("prop-dissolve-valid");
        const edgeId = [...mesh.edges.keys()][index]!;
        const ctx = createMeshOperationContext(ids);
        dissolveEdge(mesh, { edgeId }, ctx);
        expect(mesh.faces.size).toBe(5);
        assertClosedManifold(mesh);
      }),
      { numRuns: 20 },
    );
  });
});
