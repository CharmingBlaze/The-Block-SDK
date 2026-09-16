import { SchemaError } from "@modeling-kit/core";
import { triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import {
  generateFloor,
  generateProfileExtrude,
  generateWall,
  generateWallPath,
  ProfileExtrudePreview,
} from "../src/index";

const square: Array<readonly [number, number]> = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
];

describe("geometry-extrude profile adapter", () => {
  it("extrudes a floor into a closed Y-up mesh with corner UVs", () => {
    const result = generateFloor(square, { thickness: 0.25 });
    const validity = validateMesh(result.mesh);
    expect(validity.valid, validity.errors.map((issue) => issue.code).join(",")).toBe(true);
    expect(validity.statistics.isClosed).toBe(true);
    expect(result.mesh.faces.size).toBeGreaterThan(0);

    let minY = Infinity;
    let maxY = -Infinity;
    for (const vertex of result.mesh.vertices.values()) {
      minY = Math.min(minY, vertex.position[1]);
      maxY = Math.max(maxY, vertex.position[1]);
    }
    expect(maxY - minY).toBeCloseTo(0.25, 5);

    for (const corner of result.mesh.corners.values()) {
      expect(corner.uv).toBeDefined();
      expect(Number.isFinite(corner.uv![0])).toBe(true);
      expect(Number.isFinite(corner.uv![1])).toBe(true);
    }
    const tri = triangulateMesh(result.mesh);
    expect(tri.triangleFaceIds.every((id) => result.mesh.faces.has(id))).toBe(true);
  });

  it("keeps a hole empty in a floor slab", () => {
    const hole: Array<readonly [number, number]> = [
      [0.5, 0.5],
      [0.5, 1.5],
      [1.5, 1.5],
      [1.5, 0.5],
    ];
    const result = generateFloor(square, { holes: [hole], thickness: 0.2 });
    expect(validateMesh(result.mesh).valid).toBe(true);
    expect(result.mesh.faces.size).toBeGreaterThan(8);
  });

  it("builds a thick wall path without replacing the catalog wall", () => {
    const catalog = generateWall({ width: 2, height: 2, depth: 0.2 });
    expect(catalog.mesh.faces.size).toBe(6);

    const wall = generateWallPath(
      [
        [0, 0],
        [3, 0],
        [3, 2],
      ],
      { height: 1.5, thickness: 0.2 },
    );
    const validity = validateMesh(wall.mesh);
    expect(validity.valid, validity.errors.map((issue) => issue.code).join(",")).toBe(true);
    expect(wall.mesh.faces.size).toBeGreaterThan(catalog.mesh.faces.size);
  });

  it("adds bevel geometry when bevelSize is set", () => {
    const plain = generateProfileExtrude({
      profile: { kind: "polygon", outer: square },
      depth: 1,
    });
    const beveled = generateProfileExtrude({
      profile: { kind: "polygon", outer: square },
      depth: 1,
      bevelSize: 0.1,
      bevelSegments: 2,
    });
    expect(beveled.mesh.faces.size).toBeGreaterThan(plain.mesh.faces.size);
    expect(validateMesh(beveled.mesh).valid).toBe(true);
  });

  it("rejects a self-intersecting profile before calling the library", () => {
    expect(() =>
      generateProfileExtrude({
        profile: {
          kind: "polygon",
          outer: [
            [0, 0],
            [1, 1],
            [1, 0],
            [0, 1],
          ],
        },
        depth: 1,
      }),
    ).toThrow(SchemaError);
  });

  it("rejects non-positive depth", () => {
    expect(() =>
      generateProfileExtrude({
        profile: { kind: "polygon", outer: square },
        depth: 0,
      }),
    ).toThrow(/depth/);
  });

  it("replaces preview meshes without committing history", () => {
    const preview = new ProfileExtrudePreview();
    const first = preview.update({
      profile: { kind: "polygon", outer: square },
      depth: 1,
    });
    const generation = preview.revision;
    const second = preview.update({
      profile: { kind: "polygon", outer: square },
      depth: 2,
    });
    expect(preview.revision).toBeGreaterThan(generation);
    expect(second.mesh).not.toBe(first.mesh);
    preview.dispose();
    expect(preview.mesh).toBeNull();
  });

  it("extrudes a concave L profile", () => {
    const result = generateProfileExtrude({
      profile: {
        kind: "polygon",
        outer: [
          [0, 0],
          [3, 0],
          [3, 1],
          [1, 1],
          [1, 3],
          [0, 3],
        ],
      },
      depth: 0.4,
    });
    expect(validateMesh(result.mesh).valid).toBe(true);
    expect(result.mesh.faces.size).toBeGreaterThan(6);
  });
});
