import { createSequenceIdFactory, type EdgeId, type VertexId } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { validateMesh } from "../../validation/src/index.ts";
import {
  MeshBuilder,
  catmullClarkSubdivide,
  cloneMesh,
  createMeshOperationContext,
  meshFingerprint,
  setEdgeCreaseWeights,
  type HalfEdgeMesh,
} from "../src/index";

function assertValid(mesh: HalfEdgeMesh, closed: boolean): void {
  const report = validateMesh(mesh);
  expect(report.valid).toBe(true);
  expect(report.statistics.isClosed).toBe(closed);
}

function cornerOf(mesh: HalfEdgeMesh): VertexId {
  return [...mesh.vertices.keys()][0]!;
}

function lengthOf(mesh: HalfEdgeMesh, id: VertexId): number {
  const p = mesh.vertices.get(id)!.position;
  return Math.hypot(p[0], p[1], p[2]);
}

function creaseAll(mesh: HalfEdgeMesh, weight: number): void {
  setEdgeCreaseWeights(mesh, { edgeIds: [...mesh.edges.keys()], weight });
}

function createGrid(): { mesh: HalfEdgeMesh; center: VertexId; spokes: EdgeId[] } {
  const builder = new MeshBuilder();
  const ids: VertexId[][] = [];
  for (let y = 0; y < 3; y += 1) {
    const row: VertexId[] = [];
    for (let x = 0; x < 3; x += 1) {
      row.push(builder.addVertex(x, 0, y));
    }
    ids.push(row);
  }
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) {
      builder.addFace([ids[y]![x]!, ids[y]![x + 1]!, ids[y + 1]![x + 1]!, ids[y + 1]![x]!]);
    }
  }
  const mesh = builder.getMesh();
  const center = ids[1]![1]!;
  return { mesh, center, spokes: mesh.getVertexEdges(center) };
}

describe("weighted Catmull-Clark creases", () => {
  it("rejects invalid crease values without mutating the mesh", () => {
    const ids = createSequenceIdFactory("crease-invalid");
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const before = meshFingerprint(mesh);
    const edgeId = [...mesh.edges.keys()][0]!;
    expect(() => setEdgeCreaseWeights(mesh, { edgeIds: [edgeId], weight: Number.NaN })).toThrow(
      /invalid-crease-weight/,
    );
    expect(() => setEdgeCreaseWeights(mesh, { edgeIds: [edgeId], weight: Number.POSITIVE_INFINITY })).toThrow(
      /invalid-crease-weight/,
    );
    expect(() => setEdgeCreaseWeights(mesh, { edgeIds: [edgeId], weight: -0.1 })).toThrow(/invalid-crease-weight/);
    expect(() => setEdgeCreaseWeights(mesh, { edgeIds: [edgeId], weight: 1.1 })).toThrow(/invalid-crease-weight/);
    expect(meshFingerprint(mesh)).toBe(before);
  });

  it("subdivides a smooth cube and a fully creased cube", () => {
    const ids = createSequenceIdFactory("cc-cube");
    const ctx = createMeshOperationContext(ids);
    const smooth = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const corner = cornerOf(smooth);
    const beforeLen = lengthOf(smooth, corner);
    catmullClarkSubdivide(smooth, {}, ctx);
    expect(smooth.vertices.size).toBe(26);
    expect(smooth.faces.size).toBe(24);
    assertValid(smooth, true);
    expect(lengthOf(smooth, corner)).toBeLessThan(beforeLen);

    const sharp = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    creaseAll(sharp, 1);
    const sharpCorner = cornerOf(sharp);
    const sharpBefore = [...sharp.vertices.get(sharpCorner)!.position];
    catmullClarkSubdivide(sharp, {}, ctx);
    assertValid(sharp, true);
    expect(sharp.vertices.get(sharpCorner)!.position[0]).toBeCloseTo(sharpBefore[0]!, 6);
    expect(sharp.vertices.get(sharpCorner)!.position[1]).toBeCloseTo(sharpBefore[1]!, 6);
    expect(sharp.vertices.get(sharpCorner)!.position[2]).toBeCloseTo(sharpBefore[2]!, 6);
  });

  it("moves monotonically toward the sharp rule as crease weight increases", () => {
    const ids = createSequenceIdFactory("cc-mono");
    const ctx = createMeshOperationContext(ids);
    const weights = [0, 0.25, 0.5, 0.75, 1];
    const lengths: number[] = [];
    for (const weight of weights) {
      const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
      creaseAll(cube, weight);
      const corner = cornerOf(cube);
      const original = lengthOf(cube, corner);
      catmullClarkSubdivide(cube, {}, ctx);
      lengths.push(Math.abs(original - lengthOf(cube, corner)));
    }
    for (let i = 1; i < lengths.length; i += 1) {
      expect(lengths[i]!).toBeLessThanOrEqual(lengths[i - 1]! + 1e-9);
    }
    expect(lengths[0]!).toBeGreaterThan(lengths[4]!);
    expect(lengths[4]!).toBeCloseTo(0, 6);
  });

  it("classifies one, two, three, and four incident crease edges", () => {
    const ids = createSequenceIdFactory("cc-class");
    const ctx = createMeshOperationContext(ids);

    const one = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const oneEdge = [...one.edges.keys()][0]!;
    setEdgeCreaseWeights(one, { edgeIds: [oneEdge], weight: 1 });
    const oneEnds = one.getEdgeVertices(oneEdge)!;
    catmullClarkSubdivide(one, {}, ctx);
    assertValid(one, true);
    expect(lengthOf(one, oneEnds[0])).toBeLessThan(Math.hypot(1, 1, 1));

    const two = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertex = [...two.vertices.keys()][0]!;
    const pair = two.getVertexEdges(vertex).slice(0, 2);
    setEdgeCreaseWeights(two, { edgeIds: pair, weight: 1 });
    catmullClarkSubdivide(two, {}, ctx);
    assertValid(two, true);

    const three = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const corner = [...three.vertices.keys()][0]!;
    const original = [...three.vertices.get(corner)!.position];
    setEdgeCreaseWeights(three, { edgeIds: three.getVertexEdges(corner), weight: 1 });
    catmullClarkSubdivide(three, {}, ctx);
    expect(three.vertices.get(corner)!.position).toEqual(original);

    const grid = createGrid();
    setEdgeCreaseWeights(grid.mesh, { edgeIds: grid.spokes, weight: 1 });
    const centerPos = [...grid.mesh.vertices.get(grid.center)!.position];
    catmullClarkSubdivide(grid.mesh, {}, ctx);
    expect(grid.mesh.vertices.get(grid.center)!.position[0]).toBeCloseTo(centerPos[0]!, 6);
    expect(grid.mesh.vertices.get(grid.center)!.position[2]).toBeCloseTo(centerPos[2]!, 6);
    assertValid(grid.mesh, false);
  });

  it("keeps open-plane boundaries sharp and mixed interior creases", () => {
    const ids = createSequenceIdFactory("cc-bound");
    const ctx = createMeshOperationContext(ids);
    const plane = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const corner = [...plane.vertices.keys()][0]!;
    catmullClarkSubdivide(plane, {}, ctx);
    expect(plane.faces.size).toBe(4);
    const moved = plane.vertices.get(corner)!.position;
    expect(moved[0]).toBeCloseTo(-0.75, 6);
    expect(moved[1]).toBeCloseTo(0, 6);
    expect(moved[2]).toBeCloseTo(-0.75, 6);
    assertValid(plane, false);

    const mixed = createGrid();
    setEdgeCreaseWeights(mixed.mesh, { edgeIds: mixed.spokes.slice(0, 1), weight: 0.8 });
    catmullClarkSubdivide(mixed.mesh, {}, ctx);
    assertValid(mixed.mesh, false);
  });

  it("rejects non-manifold boundary vertices and rolls back", () => {
    const ids = createSequenceIdFactory("cc-nonman");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder({ meshId: ids.mesh(), manifoldPolicy: "allow-non-manifold" });
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const d = builder.addVertex(-1, 0, 0);
    const e = builder.addVertex(0, -1, 0);
    builder.addFace([a, b, c]);
    builder.addFace([a, d, e]);
    const mesh = builder.getMesh();
    const before = meshFingerprint(mesh);
    expect(() => catmullClarkSubdivide(mesh, {}, ctx)).toThrow(/non-manifold-boundary-vertex/);
    expect(meshFingerprint(mesh)).toBe(before);
  });

  it("propagates crease weights through multiple levels", () => {
    const ids = createSequenceIdFactory("cc-prop");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    creaseAll(cube, 0.75);
    const result = catmullClarkSubdivide(cube, { iterations: 2 }, ctx);
    expect(result.iterations).toBe(2);
    const creased = [...cube.edges.values()].filter((edge) => (edge.creaseWeight ?? 0) === 0.75);
    expect(creased.length).toBeGreaterThan(0);
    assertValid(cube, true);
  });

  it("preserves UV seams, materials, and normalized skin weights", () => {
    const ids = createSequenceIdFactory("cc-attr");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceId = [...cube.faces.keys()][0]!;
    cube.faces.get(faceId)!.materialSlot = 3;
    cube.faces.get(faceId)!.materialSlotId = ids.materialSlot();
    const edgeId = cube.getFaceEdges(faceId)[0]!;
    cube.edges.get(edgeId)!.isSeam = true;
    cube.edges.get(edgeId)!.creaseWeight = 1;
    for (const corner of cube.corners.values()) {
      corner.uv = [0.25, 0.5];
      corner.color = [1, 0, 0, 1];
    }
    const weights = new Map<VertexId, readonly { boneId: string; weight: number }[]>();
    for (const vertexId of cube.vertices.keys()) {
      weights.set(vertexId, [
        { boneId: "a", weight: 0.25 },
        { boneId: "b", weight: 0.75 },
      ]);
    }
    const result = catmullClarkSubdivide(cube, { skinWeights: weights }, ctx);
    expect([...cube.faces.values()].some((face) => face.materialSlot === 3)).toBe(true);
    const childSeams = [...cube.edges.values()].filter((edge) => edge.isSeam);
    expect(childSeams.length).toBeGreaterThan(0);
    expect(childSeams.every((edge) => edge.creaseWeight === 1)).toBe(true);
    const sample = [...(result.skinWeights?.values() ?? [])][0]!;
    expect(sample.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
    expect([...cube.corners.values()].some((corner) => corner.uv && corner.color)).toBe(true);
    assertValid(cube, true);
  });

  it("serializes crease weights and supports undo snapshots", () => {
    const ids = createSequenceIdFactory("cc-undo");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    creaseAll(cube, 0.4);
    const before = cloneMesh(cube);
    const fingerprint = meshFingerprint(cube);
    catmullClarkSubdivide(cube, {}, ctx);
    expect(meshFingerprint(cube)).not.toBe(fingerprint);
    cube.vertices.clear();
    cube.edges.clear();
    cube.halfEdges.clear();
    cube.corners.clear();
    cube.faces.clear();
    for (const [id, record] of before.vertices) cube.vertices.set(id, record);
    for (const [id, record] of before.edges) cube.edges.set(id, record);
    for (const [id, record] of before.halfEdges) cube.halfEdges.set(id, record);
    for (const [id, record] of before.corners) cube.corners.set(id, record);
    for (const [id, record] of before.faces) cube.faces.set(id, record);
    expect([...cube.edges.values()].every((edge) => edge.creaseWeight === 0.4)).toBe(true);
  });
});
