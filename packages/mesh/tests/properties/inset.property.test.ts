import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { createMeshOperationContext, insetFaces } from "../../src/index";
import { closedCube } from "./generators";
import { assertClosedManifold, assertUnchangedOnThrow } from "./invariants";

describe("property: insetFaces", () => {
  it("rejects non-positive distances without mutating the mesh", () => {
    assert(
      property(
        double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }).filter((d) => d <= 0),
        (distance) => {
          const { mesh, ids } = closedCube("prop-inset-invalid");
          const faceId = [...mesh.faces.keys()][0]!;
          const ctx = createMeshOperationContext(ids);
          assertUnchangedOnThrow(mesh, () =>
            insetFaces(mesh, { faceIds: [faceId], distance }, ctx),
          );
        },
      ),
      { numRuns: 25 },
    );
  });

  it("rejects inverting distances without mutating the mesh", () => {
    assert(
      property(double({ min: Math.fround(5), max: Math.fround(12), noNaN: true }), (distance) => {
        const { mesh, ids } = closedCube("prop-inset-invert");
        const faceId = [...mesh.faces.keys()][0]!;
        const ctx = createMeshOperationContext(ids);
        assertUnchangedOnThrow(mesh, () =>
          insetFaces(mesh, { faceIds: [faceId], distance }, ctx),
        );
      }),
      { numRuns: 16 },
    );
  });

  it("insets a cube face by a small distance and stays closed", () => {
    assert(
      property(double({ min: Math.fround(0.04), max: Math.fround(0.12), noNaN: true }), (distance) => {
        const { mesh, ids } = closedCube("prop-inset-valid");
        const faceId = [...mesh.faces.keys()][0]!;
        const ctx = createMeshOperationContext(ids);
        const result = insetFaces(mesh, { faceIds: [faceId], distance }, ctx);
        expect(result.innerFaceIds).toHaveLength(1);
        expect(result.ringFaceIds.length).toBeGreaterThanOrEqual(4);
        assertClosedManifold(mesh);
      }),
      { numRuns: 20 },
    );
  });
});
