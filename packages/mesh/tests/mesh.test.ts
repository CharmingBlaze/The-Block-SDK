import { describe, it, expect } from "vitest";
import { MeshBuilder, triangulateMesh, triangulatePolygon, faceNormal } from "../src/index";

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

describe("MeshBuilder validation", () => {
  it("rejects duplicate vertex and face ids", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    expect(() => builder.addVertex(1, 0, 0, v0)).toThrow(/Duplicate vertex id/);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    const faceId = builder.addFace([v0, v1, v2]);
    expect(() => builder.addFace([v0, v1, v2], { id: faceId })).toThrow(/Duplicate face id/);
  });

  it("rejects faces that reference missing vertices or repeat a corner", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    expect(() => builder.addFace([v0, v1, "missing" as typeof v0])).toThrow(/does not exist/);
    expect(() => builder.addFace([v0, v1, v1])).toThrow(/consecutive duplicate/);
  });

  it("rejects a third face on an existing edge in strict-manifold mode", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0.5, 1, 0);
    const v3 = builder.addVertex(0.5, -1, 0);
    const v4 = builder.addVertex(0.5, 0, 1);
    builder.addFace([v0, v1, v2]);
    builder.addFace([v0, v3, v1]);
    expect(() => builder.addFace([v0, v1, v4])).toThrow(/two incident faces|already occupied|non-manifold/);
  });
});

describe("concave and failure triangulation", () => {
  it("ear-clips a concave L n-gon without covering the notch", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(2, 0, 0);
    const v2 = builder.addVertex(2, 0, 1);
    const v3 = builder.addVertex(1, 0, 1);
    const v4 = builder.addVertex(1, 0, 2);
    const v5 = builder.addVertex(0, 0, 2);
    builder.addFace([v0, v1, v2, v3, v4, v5]);
    const mesh = builder.getMesh();
    const tri = triangulateMesh(mesh);
    expect(tri.triangleFaceIds.length).toBe(4);
    const notch = { x: 1.6, z: 1.6 };
    for (let i = 0; i < tri.indices.length; i += 3) {
      const a = tri.indices[i]!;
      const b = tri.indices[i + 1]!;
      const c = tri.indices[i + 2]!;
      const ax = tri.positions[a * 3]!;
      const az = tri.positions[a * 3 + 2]!;
      const bx = tri.positions[b * 3]!;
      const bz = tri.positions[b * 3 + 2]!;
      const cx = tri.positions[c * 3]!;
      const cz = tri.positions[c * 3 + 2]!;
      expect(pointInTriangle2(notch.x, notch.z, ax, az, bx, bz, cx, cz)).toBe(false);
    }
  });

  it("skips self-intersecting bowtie faces in render triangulation", () => {
    const result = triangulatePolygon(
      [
        [0, 0, 0],
        [1, 0.25, 1],
        [1, 0, 0],
        [0, 0, 1],
      ],
      { rejectSelfIntersecting: true },
    );
    expect(result.status).toBe("self-intersecting");
    expect(result.triangles).toHaveLength(0);
  });

  it("triangulates a reversed winding concave polygon", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(0, 0, 2);
    const v2 = builder.addVertex(1, 0, 2);
    const v3 = builder.addVertex(1, 0, 1);
    const v4 = builder.addVertex(2, 0, 1);
    const v5 = builder.addVertex(2, 0, 0);
    builder.addFace([v0, v1, v2, v3, v4, v5]);
    const tri = triangulateMesh(builder.getMesh());
    expect(tri.triangleFaceIds.length).toBe(4);
  });
});

function pointInTriangle2(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): boolean {
  const sign = (x1: number, z1: number, x2: number, z2: number, x3: number, z3: number) =>
    (x1 - x3) * (z2 - z3) - (x2 - x3) * (z1 - z3);
  const b1 = sign(px, pz, ax, az, bx, bz);
  const b2 = sign(px, pz, bx, bz, cx, cz);
  const b3 = sign(px, pz, cx, cz, ax, az);
  const hasNeg = b1 < -1e-9 || b2 < -1e-9 || b3 < -1e-9;
  const hasPos = b1 > 1e-9 || b2 > 1e-9 || b3 > 1e-9;
  return !(hasNeg && hasPos);
}
