import { assert, double, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createMeshOperationContext,
  deserializeMesh,
  mergeVerticesByDistance,
  serializeMesh,
  splitEdge,
} from "../../src/index";
import {
  concaveLNgon,
  creasedSeamedCube,
  holedRing,
  mirroredCube,
  mixedTriQuad,
  nearCoincidentTriangle,
  nonManifoldBowtie,
  openNgon,
  twoComponents,
} from "./generators";
import { assertManifoldAllowBoundary, assertUnchangedOnThrow } from "./invariants";

describe("property: generated topology coverage", () => {
  it("round-trips serialization on mixed, holed, mirrored, and creased meshes", () => {
    const samples = [
      mixedTriQuad("prop-ser-mixed"),
      holedRing("prop-ser-hole"),
      mirroredCube("prop-ser-mirror"),
      creasedSeamedCube("prop-ser-crease"),
      twoComponents("prop-ser-components"),
      openNgon("prop-ser-ngon", 7),
      concaveLNgon("prop-ser-concave"),
      nonManifoldBowtie("prop-ser-bowtie"),
    ];
    for (const { mesh } of samples) {
      const encoded = serializeMesh(mesh);
      const restored = deserializeMesh(encoded);
      expect(serializeMesh(restored)).toEqual(encoded);
    }
  });

  it("rejects invalid split t on an open n-gon without mutating", () => {
    assert(
      property(
        double({ min: -2, max: 3, noNaN: true, noDefaultInfinity: true }).filter((t) => t <= 0 || t >= 1),
        (t) => {
          const { mesh, ids } = openNgon("prop-ngon-split", 5);
          const edgeId = [...mesh.edges.keys()][0]!;
          const ctx = createMeshOperationContext(ids);
          const before = serializeMesh(mesh);
          assertUnchangedOnThrow(mesh, () => splitEdge(mesh, { edgeId, t }, ctx));
          expect(serializeMesh(mesh)).toEqual(before);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("splits a mixed triangle/quad mesh and keeps a manifold boundary", () => {
    assert(
      property(double({ min: Math.fround(0.2), max: Math.fround(0.8), noNaN: true }), (t) => {
        const { mesh, ids } = mixedTriQuad("prop-mixed-split");
        const edgeId = [...mesh.edges.keys()][0]!;
        const ctx = createMeshOperationContext(ids);
        splitEdge(mesh, { edgeId, t }, ctx);
        assertManifoldAllowBoundary(mesh);
        expect(mesh.faces.size).toBe(2);
      }),
      { numRuns: 16 },
    );
  });

  it("welds a near-coincident unused vertex at a tolerance boundary", () => {
    assert(
      property(double({ min: Math.fround(1e-5), max: Math.fround(1e-3), noNaN: true }), (delta) => {
        const { mesh, ids } = nearCoincidentTriangle("prop-tol-weld", delta);
        const ctx = createMeshOperationContext(ids);
        const result = mergeVerticesByDistance(mesh, 0.01, ctx);
        expect(result.mergedCount).toBeGreaterThanOrEqual(1);
        expect(mesh.vertices.size).toBe(3);
      }),
      { numRuns: 16 },
    );
  });

  it("keeps two components and a holed ring as open manifolds", () => {
    assert(
      property(integer({ min: 0, max: 3 }), (index) => {
        const ring = holedRing(`prop-hole-${String(index)}`);
        expect(ring.mesh.findBoundaryEdges().length).toBeGreaterThan(0);
        assertManifoldAllowBoundary(ring.mesh);
        const parts = twoComponents(`prop-comp-${String(index)}`);
        expect(parts.mesh.findConnectedComponents()).toHaveLength(2);
      }),
      { numRuns: 8 },
    );
  });
});
