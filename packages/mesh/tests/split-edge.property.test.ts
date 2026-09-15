import { createSequenceIdFactory } from "@modeling-kit/core";
import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MeshBuilder,
  cloneMesh,
  createMeshOperationContext,
  meshFingerprint,
  splitEdge,
} from "../src/index";

describe("property: splitEdge", () => {
  it("rejects t outside (0, 1) and leaves the mesh unchanged", () => {
    assert(
      property(
        double({ min: -4, max: 5, noNaN: true, noDefaultInfinity: true }).filter((t) => t <= 0 || t >= 1),
        (t) => {
          const ids = createSequenceIdFactory("prop-split-invalid");
          const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
          const before = meshFingerprint(mesh);
          const edgeId = [...mesh.edges.keys()][0];
          expect(edgeId).toBeDefined();
          const ctx = createMeshOperationContext(ids);
          expect(() => splitEdge(mesh, { edgeId: edgeId!, t }, ctx)).toThrow(RangeError);
          expect(meshFingerprint(mesh)).toBe(before);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("inserts a vertex on a cube edge and keeps a closed manifold", () => {
    assert(
      property(double({ min: Math.fround(0.05), max: Math.fround(0.95), noNaN: true }), (t) => {
        const ids = createSequenceIdFactory("prop-split-valid");
        const mesh = cloneMesh(MeshBuilder.createCube(1, 1, 1, ids.mesh()));
        const edgeId = [...mesh.edges.keys()][0];
        expect(edgeId).toBeDefined();
        const ctx = createMeshOperationContext(ids);
        const result = splitEdge(mesh, { edgeId: edgeId!, t }, ctx);
        expect(result.newVertexId).toBeDefined();
        expect(mesh.vertices.size).toBe(9);
        expect(mesh.findBoundaryEdges()).toHaveLength(0);
        for (const [edgeId] of mesh.edges) {
          const [f1, f2] = mesh.getEdgeFaces(edgeId);
          expect(f1).toBeTruthy();
          expect(f2).toBeTruthy();
        }
      }),
      { numRuns: 25 },
    );
  });
});
