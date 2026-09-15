import { createSequenceIdFactory } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { MeshBuilder, cloneMesh, extrudeFaces, meshFingerprint } from "../src/index";

describe("extrudeFaces", () => {
  it("extrudes a cube top face and restores from a snapshot", () => {
    const ids = createSequenceIdFactory("m");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh(), {
      posX: ids.face(),
      negX: ids.face(),
      posY: ids.face(),
      negY: ids.face(),
      posZ: ids.face(),
      negZ: ids.face(),
    });
    const top = [...cube.faces.keys()][2]!;
    const before = cloneMesh(cube);
    const result = extrudeFaces(cube, [top], 1, ids);
    expect(cube.faces.size).toBe(10);
    expect(result.capFaceIds).toHaveLength(1);
    expect(result.sideFaceIds).toHaveLength(4);
    expect(cube.findBoundaryEdges()).toHaveLength(0);
    const extruded = meshFingerprint(cube);
    cube.vertices.clear();
    const restored = cloneMesh(before);
    expect(meshFingerprint(restored)).toBe(meshFingerprint(before));
    expect(extruded).not.toBe(meshFingerprint(before));
  });
});
