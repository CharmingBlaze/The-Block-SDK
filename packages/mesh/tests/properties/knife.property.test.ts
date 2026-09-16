import { assert, double, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { createMeshOperationContext, executeKnifePlan } from "../../src/index";
import { closedCube, faceEdgeMidpoint } from "./generators";
import { assertClosedManifold } from "./invariants";

describe("property: knife", () => {
  it("cuts opposite edges of a cube face and stays closed", () => {
    assert(
      property(
        integer({ min: 0, max: 5 }),
        double({ min: Math.fround(0.04), max: Math.fround(0.2), noNaN: true }),
        (faceIndex, snapRadius) => {
          const { mesh, ids } = closedCube("prop-knife");
          const faceId = [...mesh.faces.keys()][faceIndex]!;
          const edges = mesh.getFaceEdges(faceId);
          const ctx = createMeshOperationContext(ids);
          const result = executeKnifePlan(
            mesh,
            { points: [faceEdgeMidpoint(mesh, edges[0]!), faceEdgeMidpoint(mesh, edges[2]!)], snapRadius },
            ctx,
          );
          expect(result.cutCount).toBeGreaterThanOrEqual(1);
          expect(mesh.faces.size).toBeGreaterThanOrEqual(7);
          assertClosedManifold(mesh);
        },
      ),
      { numRuns: 16 },
    );
  });
});
