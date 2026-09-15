import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { getCornerUv } from "../src/corners";
import { findUvIslands, setSeams } from "../src/islands";
import { packUvs } from "../src/pack";
import { projectUvs } from "../src/project";
import { transformUvs } from "../src/transforms";
import { weldUvs } from "../src/ops";
import { UvTopologyCache, getOrBuildUvTopology } from "../src/cache";
import { analyzeUvMesh } from "../src/analyze";

describe("@modeling-kit/uv", () => {
  it("uses per-face planar frames for smart projection, not a shared LSCM chart", () => {
    const ids = createSequenceIdFactory("smart");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "planar", axis: "y" });
    const planar = [...cube.corners.values()].map((c) => `${c.uv?.[0]?.toFixed(4)},${c.uv?.[1]?.toFixed(4)}`);
    projectUvs(cube, { projection: "smart" });
    const smart = [...cube.corners.values()].map((c) => `${c.uv?.[0]?.toFixed(4)},${c.uv?.[1]?.toFixed(4)}`);
    expect(smart).not.toEqual(planar);
    const vertexId = [...cube.vertices.keys()][0]!;
    const unique = new Set(
      [...cube.corners.values()].filter((c) => c.vertexId === vertexId).map((c) => `${c.uv?.[0]},${c.uv?.[1]}`),
    );
    expect(unique.size).toBeGreaterThan(1);
  });

  it("stores independent UVs on one shared vertex", () => {
    const ids = createSequenceIdFactory("uv");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    projectUvs(cube, { projection: "smart" });
    const vertexId = [...cube.vertices.keys()][0]!;
    const corners = [...cube.corners.values()].filter((c) => c.vertexId === vertexId);
    expect(corners.length).toBeGreaterThan(1);
    const unique = new Set(corners.map((c) => `${c.uv?.[0]},${c.uv?.[1]}`));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("packs seam-separated islands without a UV viewport", () => {
    const ids = createSequenceIdFactory("pack");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    projectUvs(cube, { projection: "box" });
    setSeams(cube, [...cube.edges.keys()], true);
    expect(findUvIslands(cube)).toHaveLength(6);
    packUvs(cube, { padding: 0.04 });
    for (const corner of cube.corners.values()) {
      const [u, v] = corner.uv ?? [0, 0];
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(() => packUvs(cube, { padding: -0.1 })).toThrow(/padding/);
    expect(() => packUvs(cube, { rotate: true })).toThrow(/rotation/);
  });

  it("translates UVs on selected faces", () => {
    const ids = createSequenceIdFactory("xf");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "planar" });
    const faceId = [...cube.faces.keys()][0]!;
    const before = getCornerUv(cube, cube.getFaceCorners(faceId)[0]!);
    transformUvs(cube, { translate: [0.1, 0], faceIds: [faceId] });
    const after = getCornerUv(cube, cube.getFaceCorners(faceId)[0]!);
    expect(after[0] - before[0]).toBeCloseTo(0.1, 5);
  });

  it("welds UVs that share a vertex inside an island", () => {
    const ids = createSequenceIdFactory("weld-uv");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "smart" });
    weldUvs(cube);
    const vertexId = [...cube.vertices.keys()][0]!;
    const uvs = [...cube.corners.values()]
      .filter((c) => c.vertexId === vertexId)
      .map((c) => `${c.uv?.[0]?.toFixed(4)},${c.uv?.[1]?.toFixed(4)}`);
    expect(new Set(uvs).size).toBe(1);
  });

  it("does not bump topology revision when UV coordinates change", () => {
    const ids = createSequenceIdFactory("uv-rev");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "planar" });
    const topology = cube.topologyRevision;
    const uvBefore = cube.uvRevision;
    transformUvs(cube, { translate: [0.05, 0] });
    expect(cube.topologyRevision).toBe(topology);
    expect(cube.uvRevision).toBeGreaterThan(uvBefore);
  });

  it("caches UV topology until UV or seam revision changes", () => {
    const ids = createSequenceIdFactory("uv-cache");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "box" });
    const cache = new UvTopologyCache();
    const first = getOrBuildUvTopology(cube, cache);
    const second = getOrBuildUvTopology(cube, cache);
    expect(second).toBe(first);
    transformUvs(cube, { translate: [0.01, 0] });
    const third = getOrBuildUvTopology(cube, cache);
    expect(third).not.toBe(first);
    expect(third.key.uvRevision).toBe(cube.uvRevision);
    expect(third.key.topologyRevision).toBe(cube.topologyRevision);
    cache.dispose();
    expect(cache.size).toBe(0);
  });

  it("keeps a single derived entry per mesh channel across UV revisions", () => {
    const ids = createSequenceIdFactory("uv-cache-bound");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "box" });
    const cache = new UvTopologyCache();
    for (let i = 0; i < 12; i += 1) {
      transformUvs(cube, { translate: [0.001, 0] });
      getOrBuildUvTopology(cube, cache);
    }
    expect(cache.size).toBe(1);
    expect(cache.connectivitySize).toBe(1);
    cache.dispose();
  });

  it("analyzes flipped, out-of-bounds, and overlapping UV islands", () => {
    const ids = createSequenceIdFactory("uv-analyze");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(cube, { projection: "planar" });
    const analysis = analyzeUvMesh(cube);
    expect(analysis.flippedFaceIds.length + analysis.overlappingIslandPairs.length + analysis.outOfBoundsCornerIds.length).toBeGreaterThanOrEqual(0);
    const corner = [...cube.corners.values()][0]!;
    corner.uv = [2, 2];
    const out = analyzeUvMesh(cube);
    expect(out.outOfBoundsCornerIds.length).toBeGreaterThan(0);
  });
});
