import { describe, expect, it } from "vitest";
import { MeshBuilder } from "@modeling-kit/mesh";
import { syncDerivedGeometry } from "../src/geometry";

describe("syncDerivedGeometry revision gate", () => {
  it("copies positions without retessellating when topology is unchanged", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const first = syncDerivedGeometry(cube);
    const topology = cube.topologyRevision;
    const vertex = [...cube.vertices.values()][0]!;
    vertex.position[0] += 0.4;
    cube.bumpPositionsRevision();
    const second = syncDerivedGeometry(cube, {
      geometry: first.geometry,
      mapping: first.mapping,
      topologyRevision: topology,
    });
    expect(second.reused).toBe(true);
    expect(second.triangulated).toBeUndefined();
    expect(second.geometry).toBe(first.geometry);
    const renderIndex = first.mapping.renderVertexToVertex.indexOf(vertex.id);
    expect(renderIndex).toBeGreaterThanOrEqual(0);
    const positions = second.geometry.getAttribute("position")!.array;
    expect(positions[renderIndex * 3]).toBeCloseTo(vertex.position[0]);
  });
});
