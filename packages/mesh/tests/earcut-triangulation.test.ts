import { triangulatePolygon } from "../src/index";
import { describe, expect, it } from "vitest";

const square: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [2, 0, 0],
  [2, 2, 0],
  [0, 2, 0],
];

const concaveL: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [2, 0, 0],
  [2, 1, 0],
  [1, 1, 0],
  [1, 2, 0],
  [0, 2, 0],
];

describe("earcut triangulation corpus", () => {
  it("keeps convex quads on the ear clipper", () => {
    const result = triangulatePolygon(square);
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earclip");
    expect(result.triangles).toHaveLength(2);
  });

  it("uses earcut for a concave L without holes", () => {
    const result = triangulatePolygon(concaveL);
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles.length).toBeGreaterThanOrEqual(4);
    for (const tri of result.triangles) {
      for (const index of tri) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(concaveL.length);
      }
    }
  });

  it("triangulates a square with a hole", () => {
    const hole: readonly (readonly [number, number, number])[] = [
      [0.5, 0.5, 0],
      [0.5, 1.5, 0],
      [1.5, 1.5, 0],
      [1.5, 0.5, 0],
    ];
    const result = triangulatePolygon(square, { holes: [hole] });
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles.length).toBeGreaterThanOrEqual(8);
  });

  it("triangulates multiple holes", () => {
    const holes = [
      [
        [0.2, 0.2, 0],
        [0.2, 0.6, 0],
        [0.6, 0.6, 0],
        [0.6, 0.2, 0],
      ],
      [
        [1.2, 1.2, 0],
        [1.2, 1.7, 0],
        [1.7, 1.7, 0],
        [1.7, 1.2, 0],
      ],
    ] as const;
    const result = triangulatePolygon(square, { holes });
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles.length).toBeGreaterThan(0);
  });

  it("handles near-collinear boundary vertices", () => {
    const result = triangulatePolygon([
      [0, 0, 0],
      [1, 0, 0],
      [1 + 1e-9, 1e-9, 0],
      [2, 0, 0],
      [2, 2, 0],
      [0, 2, 0],
    ]);
    expect(result.status).toBe("ok");
    expect(result.triangles.length).toBeGreaterThan(0);
  });

  it("accepts a reversed outer loop and reports reversed", () => {
    const reversed = [...square].reverse();
    const result = triangulatePolygon(reversed);
    expect(result.status).toBe("ok");
    expect(result.triangles).toHaveLength(2);
  });

  it("rejects non-finite coordinates", () => {
    const result = triangulatePolygon([
      [0, 0, 0],
      [1, Number.NaN, 0],
      [0, 1, 0],
    ]);
    expect(result.status).toBe("failed");
    expect(result.triangles).toEqual([]);
  });

  it("rejects unusable projections", () => {
    const result = triangulatePolygon([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    expect(result.status).toBe("degenerate");
  });

  it("can force earcut on a convex polygon", () => {
    const result = triangulatePolygon(square, { backend: "earcut" });
    expect(result.status).toBe("ok");
    expect(result.backend).toBe("earcut");
    expect(result.triangles).toHaveLength(2);
  });

  it("treats a hole larger than the outer loop as a failure", () => {
    const hugeHole: readonly (readonly [number, number, number])[] = [
      [-1, -1, 0],
      [-1, 4, 0],
      [4, 4, 0],
      [4, -1, 0],
    ];
    const result = triangulatePolygon(square, { holes: [hugeHole] });
    expect(result.status).toBe("failed");
  });
});
