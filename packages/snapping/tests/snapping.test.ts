import { describe, expect, it } from "vitest";
import { MeshBuilder } from "@modeling-kit/mesh";
import { querySnap, snapAngle, snapToGrid, snapToPoints, snapVectorIncrement } from "../src/index";

describe("@modeling-kit/snapping", () => {
  it("snaps vectors to grid and increments", () => {
    const grid = snapToGrid({ x: 1.4, y: -0.6, z: 2.2 }, 1);
    expect(grid.x).toBe(1);
    expect(grid.y).toBe(-1);
    expect(grid.z).toBe(2);
    const stepped = snapVectorIncrement({ x: 0.24, y: 0.76, z: 0 }, 0.25);
    expect(stepped.x).toBeCloseTo(0.25);
    expect(stepped.y).toBeCloseTo(0.75);
  });

  it("snaps angles and nearest points", () => {
    expect(snapAngle(0.3, Math.PI / 2)).toBeCloseTo(0);
    const hit = snapToPoints(
      { x: 0.1, y: 0, z: 0 },
      [{ id: "v", position: { x: 0, y: 0, z: 0 } }],
      0.5,
    );
    expect(hit.matched).toBe(true);
    expect(hit.targetId).toBe("v");
  });

  it("prefers a cube vertex over grid when both are in range", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const vertex = [...cube.vertices.values()][0]!.position;
    const point = { x: vertex[0] + 0.08, y: vertex[1] + 0.08, z: vertex[2] + 0.08 };
    const hit = querySnap(cube, point, { radius: 0.4, gridSize: 1 });
    expect(hit.matched).toBe(true);
    expect(hit.targetType).toBe("vertex");
    expect(hit.worldPosition?.x).toBeCloseTo(vertex[0]);
  });

  it("snaps to an edge midpoint", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const edgeId = [...cube.edges.keys()][0]!;
    const ends = cube.getEdgeVertices(edgeId)!;
    const a = cube.vertices.get(ends[0])!.position;
    const b = cube.vertices.get(ends[1])!.position;
    const mid = { x: (a[0] + b[0]) * 0.5, y: (a[1] + b[1]) * 0.5, z: (a[2] + b[2]) * 0.5 };
    const hit = querySnap(cube, { x: mid.x + 0.02, y: mid.y + 0.02, z: mid.z + 0.02 }, { radius: 0.3 });
    expect(hit.matched).toBe(true);
    expect(hit.targetType).toBe("midpoint");
  });

  it("snaps to a face centroid", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const faceId = [...cube.faces.keys()][0]!;
    const loop = cube.getFaceVertices(faceId);
    let x = 0;
    let y = 0;
    let z = 0;
    for (const id of loop) {
      const p = cube.vertices.get(id)!.position;
      x += p[0];
      y += p[1];
      z += p[2];
    }
    const c = { x: x / loop.length, y: y / loop.length, z: z / loop.length };
    const hit = querySnap(cube, c, { radius: 0.2 });
    expect(hit.matched).toBe(true);
    expect(hit.targetType).toBe("face");
  });

  it("rejects empty meshes and a zero radius", () => {
    const empty = MeshBuilder.createCube(2, 2, 2);
    empty.vertices.clear();
    expect(querySnap(empty, { x: 0, y: 0, z: 0 }, { radius: 1 }).matched).toBe(false);
    const cube = MeshBuilder.createCube(2, 2, 2);
    expect(querySnap(cube, { x: 0, y: 0, z: 0 }, { radius: 0 }).matched).toBe(false);
  });

  it("excludes a vertex id and keeps a previous target with hysteresis", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const [first, second] = [...cube.vertices.values()];
    const a = first!.position;
    const b = second!.position;
    const nearA = { x: a[0] + 0.05, y: a[1] + 0.05, z: a[2] + 0.05 };
    const excluded = querySnap(cube, nearA, { radius: 0.4, excludeTargetIds: [first!.id] });
    expect(excluded.targetId).not.toBe(first!.id);
    const kept = querySnap(cube, nearA, {
      radius: 0.5,
      previousTargetId: first!.id,
      hysteresis: 0.4,
    });
    expect(kept.targetId).toBe(first!.id);
    expect(b).toBeDefined();
  });
});
