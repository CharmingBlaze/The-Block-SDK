import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { catmullClarkSubdivide, createMeshOperationContext } from "../../src/index";
import { closedCube, creasedSeamedCube, mirroredCube } from "./generators";
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

  it("subdivides a mirrored cube once and stays closed", () => {
    const { mesh, ids } = mirroredCube("prop-cc-mirror");
    const ctx = createMeshOperationContext(ids);
    const result = catmullClarkSubdivide(mesh, { iterations: 1 }, ctx);
    expect(result.iterations).toBe(1);
    expect(mesh.faces.size).toBe(24);
    assertClosedManifold(mesh);
  });

  it("subdivides a creased cube once and stays closed", () => {
    const { mesh, ids } = creasedSeamedCube("prop-cc-crease");
    const ctx = createMeshOperationContext(ids);
    catmullClarkSubdivide(mesh, { iterations: 1 }, ctx);
    expect(mesh.faces.size).toBe(24);
    assertClosedManifold(mesh);
  });
});
