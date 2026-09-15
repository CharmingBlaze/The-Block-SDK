import { describe, it, expect } from "vitest";
import { MeshBuilder, triangulateMesh, faceNormal } from "../src/index";

describe("HalfEdgeMesh & MeshBuilder", () => {
  it("procedurally generates a valid 6-face polygonal box", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);

    expect(cube.vertices.size).toBe(8);
    expect(cube.edges.size).toBe(12);
    expect(cube.halfEdges.size).toBe(24);
    expect(cube.faces.size).toBe(6);

    // Verify 2-manifold closed surface: no boundary edges
    const boundaries = cube.findBoundaryEdges();
    expect(boundaries.length).toBe(0);

    // Every edge must be shared by exactly 2 faces
    for (const [eId] of cube.edges) {
      const [f1, f2] = cube.getEdgeFaces(eId);
      expect(f1).toBeDefined();
      expect(f2).toBeDefined();
      expect(f1).not.toBe(f2);
    }

    // Every vertex in a cube is shared by 3 edges and 3 faces
    for (const [vId] of cube.vertices) {
      const vEdges = cube.getVertexEdges(vId);
      const vFaces = cube.getVertexFaces(vId);
      expect(vEdges.length).toBe(3);
      expect(vFaces.length).toBe(3);
    }
  });

  it("winds cube faces outward in right-handed space", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const axes = [...cube.faces.keys()].map((id) => faceNormal(cube, id));
    expect(axes.some((n) => n.z > 0.9)).toBe(true);
    expect(axes.some((n) => n.z < -0.9)).toBe(true);
    expect(axes.some((n) => n.y > 0.9)).toBe(true);
    expect(axes.some((n) => n.y < -0.9)).toBe(true);
    expect(axes.some((n) => n.x > 0.9)).toBe(true);
    expect(axes.some((n) => n.x < -0.9)).toBe(true);
  });

  it("identifies boundary edges on open meshes", () => {
    const quad = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);

    expect(quad.vertices.size).toBe(4);
    expect(quad.edges.size).toBe(4);
    expect(quad.faces.size).toBe(1);

    const boundaries = quad.findBoundaryEdges();
    expect(boundaries.length).toBe(4);
  });

  it("finds connected components", () => {
    const builder = new MeshBuilder();
    // Island 1: triangle
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    builder.addFace([v0, v1, v2]);

    // Island 2: separate triangle
    const v3 = builder.addVertex(10, 0, 0);
    const v4 = builder.addVertex(11, 0, 0);
    const v5 = builder.addVertex(10, 1, 0);
    builder.addFace([v3, v4, v5]);

    const mesh = builder.getMesh();
    const components = mesh.findConnectedComponents();
    expect(components.length).toBe(2);
    expect(components[0]?.faceIds.length).toBe(1);
    expect(components[1]?.faceIds.length).toBe(1);
  });
});

describe("triangulateMesh", () => {
  it("triangulates a 6-face cube into 12 triangles with exact FaceId mapping", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const triangulated = triangulateMesh(cube);

    // 6 quads * 2 = 12 triangles
    expect(triangulated.triangleFaceIds.length).toBe(12);
    expect(triangulated.indices.length).toBe(36);

    // Every face in the cube should have exactly 2 triangles mapped to it
    const faceTriangleCounts = new Map<string, number>();
    for (const fId of triangulated.triangleFaceIds) {
      faceTriangleCounts.set(fId, (faceTriangleCounts.get(fId) ?? 0) + 1);
    }

    expect(faceTriangleCounts.size).toBe(6);
    for (const count of faceTriangleCounts.values()) {
      expect(count).toBe(2);
    }
  });

  it("respects explicit corner normals when provided", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    builder.addFace([v0, v1, v2], {
      normals: [
        [0, 1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ],
    });
    const triangulated = triangulateMesh(builder.getMesh());
    expect(triangulated.normals[0]).toBe(0);
    expect(triangulated.normals[1]).toBe(1);
    expect(triangulated.normals[2]).toBe(0);
    expect(triangulated.normals[3]).toBe(1);
    expect(triangulated.normals[4]).toBe(0);
    expect(triangulated.normals[5]).toBe(0);
    expect(triangulated.normals[6]).toBe(0);
    expect(triangulated.normals[7]).toBe(0);
    expect(triangulated.normals[8]).toBe(1);
  });
});
