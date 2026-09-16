import { MeshBuilder, triangulateMesh, triangulatePolygon } from "../src/index";
import { describe, expect, it } from "vitest";

describe("predicate regression: triangulatePolygon", () => {
  it("ear-clips a concave L at mixed scale without covering the notch", () => {
    const s = 1e5;
    const result = triangulatePolygon(
      [
        [0, 0, 0],
        [2 * s, 0, 0],
        [2 * s, 0, s],
        [s, 0, s],
        [s, 0, 2 * s],
        [0, 0, 2 * s],
      ],
      { epsilon: 1e-8 },
    );
    expect(result.status).toBe("ok");
    expect(result.reversed).toBe(false);
    expect(result.triangles).toHaveLength(4);
  });

  it("emits two triangles for both CCW and clockwise XY quads", () => {
    const ccw = triangulatePolygon(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
      { epsilon: 1e-10 },
    );
    const cw = triangulatePolygon(
      [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
      { epsilon: 1e-10 },
    );
    expect(ccw.status).toBe("ok");
    expect(cw.status).toBe("ok");
    expect(ccw.reversed).toBe(false);
    expect(ccw.triangles).toHaveLength(2);
    expect(cw.triangles).toHaveLength(2);
  });

  it("triangulates a nearly collinear convex quad", () => {
    const result = triangulatePolygon([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1e-9, 0],
      [0, 1e-8, 0],
    ]);
    expect(result.status).toBe("ok");
    expect(result.triangles.length).toBeGreaterThanOrEqual(1);
  });

  it("triangulates a very small CCW triangle", () => {
    const result = triangulatePolygon([
      [0, 0, 0],
      [1e-9, 0, 0],
      [0, 1e-9, 0],
    ]);
    expect(["ok", "degenerate"]).toContain(result.status);
    if (result.status === "ok") {
      expect(result.reversed).toBe(false);
      expect(result.triangles).toEqual([[0, 1, 2]]);
    }
  });

  it("rejects a bowtie as self-intersecting at large scale", () => {
    const result = triangulatePolygon(
      [
        [0, 0, 0],
        [1e6, 2.5e5, 1e6],
        [1e6, 0, 0],
        [0, 0, 1e6],
      ],
      { rejectSelfIntersecting: true },
    );
    expect(result.status).toBe("self-intersecting");
    expect(result.triangles).toHaveLength(0);
  });

  it("is deterministic for the same polygon", () => {
    const points: Array<readonly [number, number, number]> = [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 1],
      [1, 0, 1],
      [1, 0, 2],
      [0, 0, 2],
    ];
    const a = triangulatePolygon(points);
    const b = triangulatePolygon(points);
    expect(a).toEqual(b);
  });
});

describe("predicate regression: mesh triangulation", () => {
  it("keeps FaceId mapping on a near-coplanar n-gon", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(2, 0, 0);
    const v2 = builder.addVertex(2, 1e-10, 1);
    const v3 = builder.addVertex(0, -1e-10, 1);
    const face = builder.addFace([v0, v1, v2, v3]);
    const tri = triangulateMesh(builder.getMesh());
    expect(tri.triangleFaceIds.length).toBe(2);
    expect(tri.triangleFaceIds.every((id) => id === face)).toBe(true);
  });
});
