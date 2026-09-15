import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  MeshBuilder,
  createMeshOperationContext,
  executeKnifeCutPlan,
  planKnifeCuts,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { KnifeTool } from "../src/knife-tool";
import { cutFace, splitEdge } from "../src/knife";

function assertTwoManifold(mesh: HalfEdgeMesh, closed: boolean): void {
  const boundary = mesh.findBoundaryEdges();
  expect(boundary.length === 0).toBe(closed);
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    const count = (f1 ? 1 : 0) + (f2 ? 1 : 0);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
    if (closed) {
      expect(count).toBe(2);
    }
  }
  for (const he of mesh.halfEdges.values()) {
    expect(mesh.vertices.has(he.origin)).toBe(true);
    expect(mesh.edges.has(he.edgeId)).toBe(true);
    if (he.twin) {
      expect(mesh.halfEdges.has(he.twin)).toBe(true);
    }
  }
  for (const vertex of mesh.vertices.values()) {
    if (vertex.halfEdge) {
      expect(mesh.halfEdges.has(vertex.halfEdge)).toBe(true);
    }
  }
}

describe("splitEdge and cutFace", () => {
  it("splits a cube edge and keeps a closed 2-manifold", () => {
    const ids = createSequenceIdFactory("split");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const split = splitEdge(cube, edgeId, 0.35, ids);
    expect(cube.vertices.size).toBe(9);
    expect(cube.faces.size).toBe(6);
    expect(cube.edges.has(split.edgeIds[0])).toBe(true);
    expect(cube.edges.has(split.edgeIds[1])).toBe(true);
    assertTwoManifold(cube, true);
  });

  it("cuts a cube face between two opposite edge splits", () => {
    const ids = createSequenceIdFactory("cut");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const top = [...cube.faces.keys()][2]!;
    const faceEdges = cube.getFaceEdges(top);
    const a = faceEdges[0]!;
    const b = faceEdges[2]!;
    const result = cutFace(
      cube,
      top,
      { kind: "edge", edgeId: a, t: 0.3 },
      { kind: "edge", edgeId: b, t: 0.6 },
      ids,
    );
    expect(result.faceIds).toHaveLength(2);
    expect(cube.faces.size).toBe(7);
    expect(cube.faces.has(result.faceIds[0])).toBe(true);
    expect(cube.faces.has(result.faceIds[1])).toBe(true);
    expect(cube.getFaceVertices(result.faceIds[0]!).length).toBeGreaterThanOrEqual(3);
    expect(cube.getFaceVertices(result.faceIds[1]!).length).toBeGreaterThanOrEqual(3);
    assertTwoManifold(cube, true);
  });

  it("stays manifold after several arbitrary cuts on a closed cube", () => {
    const ids = createSequenceIdFactory("many");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    let faceId = [...cube.faces.keys()][0]!;
    for (let n = 0; n < 4; n += 1) {
      const edges = cube.getFaceEdges(faceId);
      expect(edges.length).toBeGreaterThanOrEqual(4);
      const cut = cutFace(
        cube,
        faceId,
        { kind: "edge", edgeId: edges[0]!, t: 0.25 + n * 0.05 },
        { kind: "edge", edgeId: edges[2]!, t: 0.7 - n * 0.04 },
        ids,
      );
      faceId = cut.faceIds[0]!;
      assertTwoManifold(cube, true);
    }
    expect(cube.faces.size).toBe(10);
  });

  it("keeps an open quad disk as a single boundary after a face cut", () => {
    const ids = createSequenceIdFactory("open");
    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const faceId = [...quad.faces.keys()][0]!;
    const edges = quad.getFaceEdges(faceId);
    cutFace(
      quad,
      faceId,
      { kind: "edge", edgeId: edges[0]!, t: 0.4 },
      { kind: "edge", edgeId: edges[2]!, t: 0.55 },
      ids,
    );
    expect(quad.faces.size).toBe(2);
    expect(quad.findBoundaryEdges()).toHaveLength(6);
    assertTwoManifold(quad, false);
  });

  it("rejects a cut along an existing edge", () => {
    const ids = createSequenceIdFactory("bad");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const faceId = [...cube.faces.keys()][0]!;
    const verts = cube.getFaceVertices(faceId);
    expect(() =>
      cutFace(
        cube,
        faceId,
        { kind: "vertex", vertexId: verts[0]! },
        { kind: "vertex", vertexId: verts[1]! },
        ids,
      ),
    ).toThrow(/existing edge/);
  });

  it("plans and executes a contiguous knife cut across two cube faces", () => {
    const ids = createSequenceIdFactory("multiface");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const shared = [...cube.edges.keys()].find((id) => {
      const [f1, f2] = cube.getEdgeFaces(id);
      return Boolean(f1 && f2);
    })!;
    const [faceA, faceB] = cube.getEdgeFaces(shared);
    const edgeA = cube.getFaceEdges(faceA!).find((id) => id !== shared)!;
    const edgeB = cube.getFaceEdges(faceB!).find((id) => id !== shared)!;
    const mid = (edgeId: typeof shared): [number, number, number] => {
      const ends = cube.getEdgeVertices(edgeId)!;
      const a = cube.vertices.get(ends[0])!.position;
      const b = cube.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    const pA = mid(edgeA);
    const pB = mid(edgeB);
    const points = [
      {
        faceId: faceA!,
        position: { x: pA[0], y: pA[1], z: pA[2] },
        attachment: { type: "edge" as const, edgeId: edgeA, t: 0.5 },
      },
      {
        faceId: faceB!,
        position: { x: pB[0], y: pB[1], z: pB[2] },
        attachment: { type: "edge" as const, edgeId: edgeB, t: 0.5 },
      },
    ];
    const ctx = createMeshOperationContext(ids);
    const plan = planKnifeCuts(cube, points, ctx);
    expect(plan.cuts.length).toBeGreaterThanOrEqual(2);
    const result = executeKnifeCutPlan(cube, plan, ctx);
    expect(result.cutCount).toBeGreaterThanOrEqual(1);
    expect(cube.faces.size).toBeGreaterThan(6);
    assertTwoManifold(cube, true);
  });

  it("previewPoint uses the snapping package on a cube vertex", () => {
    const ids = createSequenceIdFactory("knife-preview-snap");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const corner = [...cube.vertices.values()][0]!.position;
    const tool = new KnifeTool();
    const preview = tool.previewPoint(
      [corner[0] + 0.05, corner[1] + 0.05, corner[2] + 0.05],
      { mesh: cube, snapRadius: 0.3 },
    );
    expect(preview[0]).toBeCloseTo(corner[0]);
    expect(preview[1]).toBeCloseTo(corner[1]);
    expect(preview[2]).toBeCloseTo(corner[2]);
  });
});
