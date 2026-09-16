import { createSequenceIdFactory } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  MeshBuilder,
  cloneMesh,
  createMeshOperationContext,
  deserializeMesh,
  serializeMesh,
  splitEdge,
  triangulateMesh,
} from "../src/index";

describe("MESH-001 kernel queries", () => {
  it("reports a complete vertex star on a boundary quad", () => {
    const quad = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    for (const [vertexId] of quad.vertices) {
      expect(quad.getVertexEdges(vertexId)).toHaveLength(2);
      expect(quad.getVertexFaces(vertexId)).toHaveLength(1);
    }
    const faceId = [...quad.faces.keys()][0]!;
    expect(quad.getFaceVertices(faceId)).toHaveLength(4);
    expect(quad.getFaceEdges(faceId)).toHaveLength(4);
    expect(quad.getFaceCorners(faceId)).toHaveLength(4);
    expect(quad.getAdjacentFaces(faceId)).toHaveLength(0);
    expect(quad.findBoundaryEdges()).toHaveLength(4);
    expect(quad.findConnectedComponents()).toHaveLength(1);
  });

  it("reports four neighbors per cube face and a closed quad edge loop", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    for (const faceId of cube.faces.keys()) {
      expect(cube.getAdjacentFaces(faceId)).toHaveLength(4);
    }
    const edgeId = [...cube.edges.keys()][0]!;
    const loop = cube.findEdgeLoops(edgeId);
    expect(loop.length).toBeGreaterThanOrEqual(1);
    expect(new Set(loop).size).toBe(loop.length);
  });
});

describe("MESH-003 attributes", () => {
  it("round-trips corner UV/color, edge seam, and face material slot", () => {
    const builder = new MeshBuilder();
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const faceId = builder.addFace([a, b, c], {
      uvs: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors: [
        [1, 0, 0, 1],
        [0, 1, 0, 1],
        [0, 0, 1, 1],
      ],
      materialSlot: 2,
    });
    const mesh = builder.getMesh();
    const edgeId = mesh.getFaceEdges(faceId)[0]!;
    const edge = mesh.edges.get(edgeId)!;
    edge.isSeam = true;
    edge.creaseAngle = 0.5;
    edge.creaseWeight = 0.5;
    const restored = deserializeMesh(serializeMesh(mesh));
    const corners = restored.getFaceCorners(faceId).map((id) => restored.corners.get(id)!);
    expect(corners[0]?.uv).toEqual([0, 0]);
    expect(corners[1]?.color).toEqual([0, 1, 0, 1]);
    expect(restored.faces.get(faceId)?.materialSlot).toBe(2);
    expect(restored.edges.get(edgeId)?.isSeam).toBe(true);
    expect(restored.edges.get(edgeId)?.creaseAngle).toBe(0.5);
    expect(restored.edges.get(edgeId)?.creaseWeight).toBe(0.5);
  });
});

describe("MESH-004 triangulation FaceId", () => {
  it("maps every n-gon triangle to a live face", () => {
    const builder = new MeshBuilder();
    const ring = [
      builder.addVertex(0, 0, 0),
      builder.addVertex(1, 0, 0),
      builder.addVertex(1.5, 1, 0),
      builder.addVertex(0.5, 1.5, 0),
      builder.addVertex(-0.5, 1, 0),
    ];
    const faceId = builder.addFace(ring);
    const mesh = builder.getMesh();
    const tri = triangulateMesh(mesh);
    expect(tri.triangleFaceIds).toHaveLength(3);
    expect(tri.triangleFaceIds.every((id) => mesh.faces.has(id))).toBe(true);
    expect(new Set(tri.triangleFaceIds)).toEqual(new Set([faceId]));
  });
});

describe("MESH-OP-001 splitEdge invalid input", () => {
  it("rejects t outside (0,1) without mutating the mesh", () => {
    const ids = createSequenceIdFactory("t");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const before = cloneMesh(mesh);
    const edgeId = [...mesh.edges.keys()][0]!;
    expect(() => splitEdge(mesh, { edgeId, t: 0 }, createMeshOperationContext(ids))).toThrow(
      /t must be/,
    );
    expect(() => splitEdge(mesh, { edgeId, t: 1 }, createMeshOperationContext(ids))).toThrow(
      /t must be/,
    );
    expect(serializeMesh(mesh)).toEqual(serializeMesh(before));
  });
});
