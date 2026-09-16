import { describe, expect, it } from "vitest";
import { MeshBuilder } from "../src/builder";
import { createMeshLocalBvh } from "../src/bvh/mesh-local-bvh";
import { triangulateMesh } from "../src/triangulate";
import { tessellateValidatedFace } from "../src/triangulation/fast-path";

describe("tessellateValidatedFace", () => {
  it("dumps a triangle as (0,1,2)", () => {
    expect(
      tessellateValidatedFace([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ]),
    ).toEqual([[0, 1, 2]]);
  });

  it("splits a planar convex quad as (0,1,2)+(0,2,3)", () => {
    expect(
      tessellateValidatedFace([
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ]),
    ).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
  });

  it("rejects a concave quad so Earcut can run", () => {
    expect(
      tessellateValidatedFace([
        [0, 0, 0],
        [3, 0, 0],
        [1, 0, 1],
        [3, 0, 2],
      ]),
    ).toBeNull();
  });
});

describe("triangulateMesh fast path", () => {
  it("keeps cube FaceIds on 12 triangles without dropping a face", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const tri = triangulateMesh(cube);
    expect(tri.triangleFaceIds).toHaveLength(12);
    expect(new Set(tri.triangleFaceIds).size).toBe(6);
  });
});

describe("MeshBuilder large-mesh batching", () => {
  it("defers topology revision until getMesh for procedural cubes", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    expect(cube.topologyRevision).toBe(1);
    expect(cube.faces.size).toBe(6);
  });

  it("still rejects zero-area faces on the public API", () => {
    const builder = new MeshBuilder();
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(2, 0, 0);
    expect(() => builder.addFace([a, b, c])).toThrow(/zero area/);
  });
});

describe("MeshLocalBvh", () => {
  it("rebuilds on topology, refits on positions, and ignores materials", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const bvh = createMeshLocalBvh(cube);
    expect(bvh.rebuildCount).toBe(1);
    expect(bvh.refitCount).toBe(0);
    expect(bvh.primitiveCount).toBe(12);

    const hit = bvh.raycast({ x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: -1 });
    expect(hit?.faceId).toBeDefined();
    expect(hit?.distance).toBeGreaterThan(0);

    cube.bumpMaterialsRevision();
    bvh.sync(cube);
    expect(bvh.rebuildCount).toBe(1);
    expect(bvh.refitCount).toBe(0);

    const vertex = [...cube.vertices.values()][0]!;
    vertex.position[0] += 0.25;
    cube.bumpPositionsRevision();
    bvh.sync(cube);
    expect(bvh.rebuildCount).toBe(1);
    expect(bvh.refitCount).toBe(1);

    cube.bumpRevision();
    bvh.sync(cube);
    expect(bvh.rebuildCount).toBe(2);
    bvh.dispose();
  });
});
