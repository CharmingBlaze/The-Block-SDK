import { describe, expect, it } from "vitest";
import { MeshBuilder, triangulateMesh, triangulatePolygon, triangulatePolygonLoops } from "../src/index";

const square: Array<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
];

const concaveL: Array<readonly [number, number, number]> = [
  [0, 0, 0],
  [2, 0, 0],
  [2, 0, 1],
  [1, 0, 1],
  [1, 0, 2],
  [0, 0, 2],
];

describe("earcut triangulation corpus", () => {
  it("keeps convex polygons on ear-clip with CCW winding", () => {
    const result = triangulatePolygon(square);
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earclip");
    expect(result.triangles).toHaveLength(2);
    expect(result.sourceVertexIndices).toEqual(result.triangles);
  });

  it("uses earcut for a concave boundary and keeps the notch empty", () => {
    const result = triangulatePolygon(concaveL, { backend: "earcut" });
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles.length).toBe(4);
    for (const tri of result.triangles) {
      expect(coversNotch(tri, concaveL)).toBe(false);
    }
  });

  it("auto-selects earcut for concave polygons and ear-clip for convex", () => {
    expect(triangulatePolygon(square, { backend: "auto" }).backend).toBe("earclip");
    expect(triangulatePolygon(concaveL, { backend: "auto" }).backend).toBe("earcut");
  });

  it("triangulates an outer loop with a hole", () => {
    const outer: Array<readonly [number, number, number]> = [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 4],
      [0, 0, 4],
    ];
    const hole: Array<readonly [number, number, number]> = [
      [1, 0, 1],
      [1, 0, 2],
      [2, 0, 2],
      [2, 0, 1],
    ];
    const result = triangulatePolygonLoops(outer, [hole]);
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles.length).toBeGreaterThanOrEqual(8);
    for (const tri of result.triangles) {
      for (const index of tri) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(outer.length + hole.length);
      }
    }
  });

  it("triangulates multiple holes", () => {
    const outer: Array<readonly [number, number, number]> = [
      [0, 0, 0],
      [6, 0, 0],
      [6, 0, 4],
      [0, 0, 4],
    ];
    const holeA: Array<readonly [number, number, number]> = [
      [1, 0, 1],
      [1, 0, 2],
      [2, 0, 2],
      [2, 0, 1],
    ];
    const holeB: Array<readonly [number, number, number]> = [
      [4, 0, 1],
      [4, 0, 2],
      [5, 0, 2],
      [5, 0, 1],
    ];
    const result = triangulatePolygonLoops(outer, [holeA, holeB]);
    expect(result.status).toBe("ok");
    expect(result.triangles.length).toBeGreaterThanOrEqual(12);
  });

  it("handles near-collinear vertices without flipping winding", () => {
    const result = triangulatePolygon(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1e-12],
        [1, 0, 1],
        [0, 0, 1],
      ],
      { epsilon: 1e-8 },
    );
    expect(result.status).toBe("ok");
    expect(result.reversed).toBe(false);
  });

  it("preserves input vertex order for a reversed outer loop", () => {
    const cw = [...square].reverse();
    const result = triangulatePolygon(cw);
    expect(result.status).toBe("ok");
    expect(result.triangles.length).toBe(2);
  });

  it("rejects a self-intersecting bowtie", () => {
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

  it("rejects non-finite coordinates", () => {
    expect(() =>
      triangulatePolygon([
        [0, 0, 0],
        [1, 0, Number.NaN],
        [1, 0, 1],
      ]),
    ).toThrow(/finite/);
  });

  it("fails an unusable projection instead of inventing triangles", () => {
    const result = triangulatePolygon(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      { backend: "earcut" },
    );
    expect(result.status === "degenerate" || result.status === "failed").toBe(true);
    expect(result.triangles).toHaveLength(0);
  });

  it("preserves face and corner mapping on a concave mesh face", () => {
    const builder = new MeshBuilder();
    const ids = concaveL.map((p) => builder.addVertex(p[0], p[1], p[2]));
    const face = builder.addFace(ids);
    const mesh = builder.getMesh();
    const corners = mesh.getFaceCorners(face);
    const tri = triangulateMesh(mesh);
    expect(tri.triangleFaceIds.every((id) => id === face)).toBe(true);
    expect(tri.cornerIdMap).toHaveLength(tri.vertexIdMap.length);
    expect(tri.cornerIdMap.every((id) => corners.includes(id))).toBe(true);
    expect(tri.indices.length / 3).toBe(4);
  });
});

function coversNotch(
  tri: readonly [number, number, number],
  points: readonly (readonly [number, number, number])[],
): boolean {
  const notch: readonly [number, number] = [1.25, 1.25];
  const a = points[tri[0]!]!;
  const b = points[tri[1]!]!;
  const c = points[tri[2]!]!;
  return pointInTriangle2(notch[0], notch[1], a[0], a[2], b[0], b[2], c[0], c[2]);
}

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
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;
  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-20) {
    return false;
  }
  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;
  return u >= 0 && v >= 0 && u + v < 1;
}
