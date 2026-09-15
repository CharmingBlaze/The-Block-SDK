import { describe, it, expect } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { healMesh, validateMesh } from "../src/index";

describe("validateMesh", () => {
  it("validates a standard procedural cube as clean and closed manifold", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const result = validateMesh(cube);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statistics.isManifold).toBe(true);
    expect(result.statistics.isClosed).toBe(true);
    expect(result.statistics.boundaryEdgeCount).toBe(0);
    expect(result.statistics.faceCount).toBe(6);
  });

  it("validates an open quad with boundary statistics", () => {
    const quad = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const result = validateMesh(quad);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statistics.isClosed).toBe(false);
    expect(result.statistics.boundaryEdgeCount).toBe(4);
  });

  it("flags zero-length edges and consecutive duplicate vertices", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(0, 0, 0); // Duplicate coordinate! Zero length edge!
    const v2 = builder.addVertex(0, 1, 0);

    builder.addFace([v0, v1, v2]);
    const mesh = builder.getMesh();

    const result = validateMesh(mesh);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ZERO_LENGTH_EDGE")).toBe(true);
  });

  it("detects non-manifold edges and pinched vertices", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    const v3 = builder.addVertex(0, 0, 1);
    const v4 = builder.addVertex(1, 1, 0);
    builder.addFace([v0, v1, v2]);
    builder.addFace([v0, v1, v3]);
    builder.addFace([v0, v1, v4]);
    const mesh = builder.getMesh();
    const result = validateMesh(mesh);
    expect(result.errors.some((e) => e.code === "NON_MANIFOLD_EDGE")).toBe(true);
    expect(result.statistics.isManifold).toBe(false);

    const pinch = new MeshBuilder();
    const a0 = pinch.addVertex(0, 0, 0);
    const a1 = pinch.addVertex(1, 0, 0);
    const a2 = pinch.addVertex(0, 1, 0);
    const b1 = pinch.addVertex(-1, 0, 0);
    const b2 = pinch.addVertex(0, -1, 0);
    pinch.addFace([a0, a1, a2]);
    pinch.addFace([a0, b1, b2]);
    const pinched = pinch.getMesh();
    const pinchResult = validateMesh(pinched);
    expect(pinchResult.errors.some((e) => e.code === "NON_MANIFOLD_VERTEX")).toBe(true);
  });

  it("flags non-finite positions", () => {
    const mesh = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const vertex = [...mesh.vertices.values()][0]!;
    vertex.position = [Number.NaN, 0, 0];
    const result = validateMesh(mesh);
    expect(result.errors.some((e) => e.code === "NON_FINITE_POSITION")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("heals isolated vertices, zero-length edges, and duplicate faces", () => {
    const ids = createSequenceIdFactory("heal");
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    builder.addVertex(9, 9, 9);
    builder.addFace([v0, v1, v2]);
    const mesh = builder.getMesh();
    const report = healMesh(mesh, ids);
    expect(report.isolatedVerticesRemoved).toBeGreaterThanOrEqual(1);
    expect(mesh.vertices.size).toBe(3);

    const dup = new MeshBuilder();
    const d0 = dup.addVertex(0, 0, 0);
    const d1 = dup.addVertex(1, 0, 0);
    const d2 = dup.addVertex(0, 1, 0);
    dup.addFace([d0, d1, d2]);
    dup.addFace([d0, d1, d2]);
    const dupMesh = dup.getMesh();
    const dupReport = healMesh(dupMesh, createSequenceIdFactory("heal-dup"));
    expect(dupReport.duplicateFacesRemoved).toBeGreaterThanOrEqual(1);
    expect(dupMesh.faces.size).toBe(1);

    const collapse = new MeshBuilder();
    const c0 = collapse.addVertex(0, 0, 0);
    const c1 = collapse.addVertex(0, 0, 0);
    const c2 = collapse.addVertex(0, 1, 0);
    collapse.addFace([c0, c1, c2]);
    const collapsed = collapse.getMesh();
    const collapseReport = healMesh(collapsed, createSequenceIdFactory("heal-z"));
    expect(collapseReport.edgesCollapsed).toBeGreaterThanOrEqual(1);
  });
});
