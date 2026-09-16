import { describe, expect, it } from "vitest";
import {
  defaultGeometryPredicates,
  isCollinear2d,
  isCollinear3d,
  isCoplanar,
  orient2d,
  orient3d,
  orientation2d,
  orientation3d,
  planarTurnSign,
  pointInPolygonEvenOdd2d,
  pointInTriangleCCW2d,
  polygonWinding2d,
  projectPointToOrientedPlane2d,
  segmentsIntersectProper2d,
} from "../src/index";

function naiveOrient2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

describe("GeometryPredicates conventions", () => {
  it("matches SDK Y-up CCW-positive winding", () => {
    expect(orient2d(0, 0, 1, 0, 0, 1)).toBeGreaterThan(0);
    expect(orient2d(0, 0, 0, 1, 1, 0)).toBeLessThan(0);
    expect(orientation2d(0, 0, 1, 0, 2, 0)).toBe(0);
  });

  it("matches right-handed tetrahedron volume", () => {
    expect(orient3d(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1)).toBeGreaterThan(0);
    expect(orient3d(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, -1)).toBeLessThan(0);
    expect(orientation3d(0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 3, 0)).toBe(0);
  });

  it("reports a CCW planar turn as positive along the face normal", () => {
    expect(planarTurnSign(0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1)).toBe(1);
    expect(planarTurnSign(0, 0, 0, 1, 0, 0, 1, -1, 0, 0, 0, 1)).toBe(-1);
  });

  it("exposes a frozen default service", () => {
    expect(defaultGeometryPredicates.orient2d(0, 0, 1, 0, 0, 1)).toBeGreaterThan(0);
    expect(Object.isFrozen(defaultGeometryPredicates)).toBe(true);
  });

  it("rejects non-finite coordinates", () => {
    expect(() => orient2d(0, 0, 1, 0, Number.NaN, 1)).toThrow(/finite/);
    expect(() => orient3d(0, 0, 0, 1, 0, 0, 0, 1, 0, Number.POSITIVE_INFINITY, 0, 1)).toThrow(
      /finite/,
    );
  });
});

describe("robust classification at awkward scales", () => {
  it("classifies exact collinear and coplanar points at large and tiny scales", () => {
    expect(isCollinear2d([1e12, 1e12], [2e12, 2e12], [3e12, 3e12])).toBe(true);
    expect(isCollinear2d([1e-12, 2e-12], [2e-12, 4e-12], [3e-12, 6e-12])).toBe(true);
    expect(isCollinear3d([0, 0, 0], [1e8, 1e8, 1e8], [2e8, 2e8, 2e8])).toBe(true);
    expect(
      isCoplanar([0, 0, 0], [1e8, 0, 0], [0, 1e8, 0], [0.25e8, 0.25e8, 0]),
    ).toBe(true);
    expect(isCoplanar([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1e-8])).toBe(false);
  });

  it("keeps the correct left-of-line sign for mixed-scale coordinates", () => {
    const sign = orientation2d(1e-8, 1e-8, 1e8, 1e8, 1e-8, 1e8);
    expect(sign).toBe(1);
    expect(orientation2d(1e-8, 1e-8, 1e8, 1e8, 1e8, 1e-8)).toBe(-1);
  });

  it("classifies a near-collinear left point that naive arithmetic may lose", () => {
    const ax = 0.247109273482918;
    const ay = 0.0733642350110996;
    const bx = 0.39269908169872414;
    const by = 0.1163522740671875;
    const cx = ax + (bx - ax) * 0.5;
    const cy = ay + (by - ay) * 0.5 + 2 ** -52;
    const robust = orient2d(ax, ay, bx, by, cx, cy);
    expect(robust).toBeGreaterThan(0);
    expect(orientation2d(ax, ay, bx, by, cx, cy)).toBe(1);
    const naive = naiveOrient2d(ax, ay, bx, by, cx, cy);
    expect(Number.isFinite(naive)).toBe(true);
  });

  it("classifies a near-coplanar point above a large triangle", () => {
    const lift = 2 ** -40;
    expect(orientation3d(0, 0, 0, 1e6, 0, 0, 0, 1e6, 0, 1e5, 1e5, lift)).toBe(1);
    expect(orientation3d(0, 0, 0, 1e6, 0, 0, 0, 1e6, 0, 1e5, 1e5, -lift)).toBe(-1);
  });

  it("is deterministic for identical inputs", () => {
    const args = [0.1, 0.2, 4.5, -1.25, 8e-7, 3.125] as const;
    expect(orient2d(...args)).toBe(orient2d(...args));
    expect(
      orient3d(0.1, 0.2, 0.3, 4.5, -1.25, 0.01, 8e-7, 3.125, -2, 1, 2, 3),
    ).toBe(orient3d(0.1, 0.2, 0.3, 4.5, -1.25, 0.01, 8e-7, 3.125, -2, 1, 2, 3));
  });
});

describe("derived 2D helpers", () => {
  it("detects proper segment crossings and ignores shared endpoints", () => {
    expect(segmentsIntersectProper2d([0, 0], [1, 1], [0, 1], [1, 0])).toBe(true);
    expect(segmentsIntersectProper2d([0, 0], [1, 0], [1, 0], [2, 0])).toBe(false);
    expect(segmentsIntersectProper2d([0, 0], [1, 0], [2, 0], [3, 0])).toBe(false);
  });

  it("tests CCW triangle inclusion including the boundary", () => {
    expect(pointInTriangleCCW2d([0.2, 0.2], [0, 0], [1, 0], [0, 1])).toBe(true);
    expect(pointInTriangleCCW2d([0.5, 0], [0, 0], [1, 0], [0, 1])).toBe(true);
    expect(pointInTriangleCCW2d([1, 1], [0, 0], [1, 0], [0, 1])).toBe(false);
  });

  it("preserves even-odd polygon membership and CCW winding", () => {
    const square: Array<readonly [number, number]> = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(polygonWinding2d(square)).toBe(1);
    expect(polygonWinding2d([...square].reverse())).toBe(-1);
    expect(pointInPolygonEvenOdd2d(1, 1, square)).toBe(true);
    expect(pointInPolygonEvenOdd2d(3, 1, square)).toBe(false);
  });

  it("projects so a CCW XY triangle stays CCW", () => {
    const a = projectPointToOrientedPlane2d(0, 0, 1, 0, 0, 0);
    const b = projectPointToOrientedPlane2d(0, 0, 1, 1, 0, 0);
    const c = projectPointToOrientedPlane2d(0, 0, 1, 0, 1, 0);
    expect(orient2d(a[0], a[1], b[0], b[1], c[0], c[1])).toBeGreaterThan(0);
  });
});
