import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { catmullClarkSubdivide, createMeshOperationContext } from "../../src/index";
import { closedCube } from "./generators";
import { assertClosedManifold } from "./invariants";

describe("property: catmullClarkSubdivide", () => {
  it("subdivides a cube for one or two levels and stays closed", () => {
    assert(
      property(integer({ min: 1, max: 2 }), (iterations) => {
        const { mesh, ids } = closedCube("prop-cc");
        const ctx = createMeshOperationContext(ids);
        const result = catmullClarkSubdivide(mesh, { iterations }, ctx);
        expect(result.iterations).toBe(iterations);
        expect(mesh.faces.size).toBe(24 * 4 ** (iterations - 1));
        assertClosedManifold(mesh);
      }),
      { numRuns: 8 },
    );
  });
});
