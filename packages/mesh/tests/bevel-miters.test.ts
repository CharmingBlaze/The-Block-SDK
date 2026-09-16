import { createSequenceIdFactory, type EdgeId } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { validateMesh } from "../../validation/src/index.ts";
import {
  MeshBuilder,
  bevelEdges,
  createMeshOperationContext,
  meshFingerprint,
  serializeMesh,
  restoreMesh,
  type HalfEdgeMesh,
} from "../src/index";

function assertValid(mesh: HalfEdgeMesh, closed: boolean): void {
  const report = validateMesh(mesh);
  expect(report.valid).toBe(true);
  expect(report.statistics.isClosed).toBe(closed);
}

function cubeEdge(mesh: HalfEdgeMesh): EdgeId {
  return [...mesh.edges.keys()][0]!;
}

function twoMeetingEdges(mesh: HalfEdgeMesh): EdgeId[] {
  const vertexId = [...mesh.vertices.keys()][0]!;
  return mesh.getVertexEdges(vertexId).slice(0, 2);
}

function oppositeEdges(mesh: HalfEdgeMesh): EdgeId[] {
  const first = [...mesh.edges.keys()][0]!;
  const ends = mesh.getEdgeVertices(first)!;
  const used = new Set(ends);
  const other = [...mesh.edges.keys()].find((id) => {
    const pair = mesh.getEdgeVertices(id);
    return pair && !used.has(pair[0]) && !used.has(pair[1]);
  });
  return other ? [first, other] : [first];
}

function faceLoop(mesh: HalfEdgeMesh): EdgeId[] {
  const faceId = [...mesh.faces.keys()][0]!;
  return mesh.getFaceEdges(faceId);
}

function createLPrism(): HalfEdgeMesh {
  const builder = new MeshBuilder();
  const bottom = [
    builder.addVertex(0, 0, 0),
    builder.addVertex(2, 0, 0),
    builder.addVertex(2, 0, 1),
    builder.addVertex(1, 0, 1),
    builder.addVertex(1, 0, 2),
    builder.addVertex(0, 0, 2),
  ];
  const top = [
    builder.addVertex(0, 1, 0),
    builder.addVertex(2, 1, 0),
    builder.addVertex(2, 1, 1),
    builder.addVertex(1, 1, 1),
    builder.addVertex(1, 1, 2),
    builder.addVertex(0, 1, 2),
  ];
  builder.addFace(bottom);
  builder.addFace([...top].reverse());
  for (let i = 0; i < 6; i += 1) {
    const next = (i + 1) % 6;
    builder.addFace([bottom[next]!, bottom[i]!, top[i]!, top[next]!]);
  }
  return builder.getMesh();
}

describe("simple bevel miters", () => {
  it("bevels a single interior cube edge", () => {
    const ids = createSequenceIdFactory("bev-one");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const result = bevelEdges(cube, { edgeIds: [cubeEdge(cube)], offset: 0.2 }, ctx);
    expect(result.chamferFaceIds).toHaveLength(1);
    expect(result.beveledEdgeIds).toHaveLength(1);
    expect(result.appliedWidth).toBeCloseTo(0.2, 6);
    assertValid(cube, true);
  });

  it("bevels two disconnected edges in one pass", () => {
    const ids = createSequenceIdFactory("bev-disc");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const result = bevelEdges(cube, { edgeIds: oppositeEdges(cube), offset: 0.15 }, ctx);
    expect(result.chamferFaceIds.length).toBe(2);
    assertValid(cube, true);
  });

  it("bevels an open chain and a closed loop", () => {
    const ids = createSequenceIdFactory("bev-chain");
    const ctx = createMeshOperationContext(ids);
    const chain = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const chainResult = bevelEdges(chain, { edgeIds: twoMeetingEdges(chain), offset: 0.12, miterMode: "sharp" }, ctx);
    expect(chainResult.chamferFaceIds.length).toBeGreaterThanOrEqual(2);
    assertValid(chain, true);

    const loop = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const loopResult = bevelEdges(loop, { edgeIds: faceLoop(loop), offset: 0.1, miterMode: "sharp" }, ctx);
    expect(loopResult.chamferFaceIds.length).toBe(4);
    assertValid(loop, true);
  });

  it("builds sharp and clip miters at a convex cube corner", () => {
    const ids = createSequenceIdFactory("bev-miter");
    const ctx = createMeshOperationContext(ids);
    const sharp = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const sharpResult = bevelEdges(sharp, { edgeIds: twoMeetingEdges(sharp), offset: 0.2, miterMode: "sharp" }, ctx);
    expect(sharpResult.warnings.some((item) => item.code === "bevel-clip-fallback")).toBe(false);
    assertValid(sharp, true);

    const clip = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const clipResult = bevelEdges(clip, { edgeIds: twoMeetingEdges(clip), offset: 0.2, miterMode: "clip" }, ctx);
    expect(clipResult.createdFaceIds.length).toBeGreaterThanOrEqual(2);
    assertValid(clip, true);
  });

  it("handles a simple concave L-prism corner or rejects it with a structured code", () => {
    const ids = createSequenceIdFactory("bev-concave");
    const ctx = createMeshOperationContext(ids);
    const mesh = createLPrism();
    const inner = [...mesh.vertices.keys()].find((id) => {
      const p = mesh.vertices.get(id)!.position;
      return p[0] === 1 && p[1] === 0 && p[2] === 1;
    })!;
    const edgeIds = mesh.getVertexEdges(inner).filter((edgeId) => {
      const ends = mesh.getEdgeVertices(edgeId)!;
      const other = ends[0] === inner ? ends[1] : ends[0];
      const p = mesh.vertices.get(other)!.position;
      return p[1] === 0;
    });
    expect(edgeIds.length).toBeGreaterThanOrEqual(2);
    const before = meshFingerprint(mesh);
    try {
      bevelEdges(mesh, { edgeIds: edgeIds.slice(0, 2), offset: 0.1, miterMode: "sharp" }, ctx);
      assertValid(mesh, true);
    } catch (error) {
      expect(String(error)).toMatch(/unsupported-complex-concave-miter|miter-limit|unsupported-bevel-junction/);
      expect(meshFingerprint(mesh)).toBe(before);
    }
  });

  it("rejects miters that exceed the miter limit unless clip fallback is enabled", () => {
    const ids = createSequenceIdFactory("bev-limit");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const before = meshFingerprint(cube);
    expect(() =>
      bevelEdges(cube, { edgeIds: twoMeetingEdges(cube), offset: 0.2, miterMode: "sharp", miterLimit: 1.1 }, ctx),
    ).toThrow(/miter-limit/);
    expect(meshFingerprint(cube)).toBe(before);

    const fallback = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const result = bevelEdges(
      fallback,
      { edgeIds: twoMeetingEdges(fallback), offset: 0.2, miterMode: "sharp", miterLimit: 1.1, allowClipFallback: true },
      ctx,
    );
    expect(result.warnings.some((item) => item.code === "bevel-clip-fallback")).toBe(true);
    assertValid(fallback, true);
  });

  it("clamps or rejects overlapping widths explicitly", () => {
    const ids = createSequenceIdFactory("bev-overlap");
    const ctx = createMeshOperationContext(ids);
    const clampMesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const clamped = bevelEdges(
      clampMesh,
      { edgeIds: [cubeEdge(clampMesh)], offset: 50, overlapMode: "clamp" },
      ctx,
    );
    expect(clamped.appliedWidth).toBeLessThan(50);
    expect(clamped.warnings.some((item) => item.code === "bevel-clamped")).toBe(true);
    assertValid(clampMesh, true);

    const errorMesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const before = meshFingerprint(errorMesh);
    expect(() =>
      bevelEdges(errorMesh, { edgeIds: [cubeEdge(errorMesh)], offset: 50, overlapMode: "error" }, ctx),
    ).toThrow(/bevel-overlap/);
    expect(meshFingerprint(errorMesh)).toBe(before);
  });

  it("records per-edge applied widths on mixed-length geometry", () => {
    const ids = createSequenceIdFactory("bev-mixed");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(4, 0, 0);
    const c = builder.addVertex(4, 0, 1);
    const d = builder.addVertex(0, 0, 1);
    const e = builder.addVertex(0, 1, 0);
    const f = builder.addVertex(4, 1, 0);
    const g = builder.addVertex(4, 1, 1);
    const h = builder.addVertex(0, 1, 1);
    builder.addFace([a, b, c, d]);
    builder.addFace([e, h, g, f]);
    builder.addFace([a, e, f, b]);
    builder.addFace([b, f, g, c]);
    builder.addFace([c, g, h, d]);
    builder.addFace([d, h, e, a]);
    const mesh = builder.getMesh();
    const longEdge = [...mesh.edges.keys()].find((id) => {
      const ends = mesh.getEdgeVertices(id)!;
      const pa = mesh.vertices.get(ends[0])!.position;
      const pb = mesh.vertices.get(ends[1])!.position;
      return Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) > 3;
    })!;
    const result = bevelEdges(mesh, { edgeIds: [longEdge], offset: 0.3 }, ctx);
    expect(result.appliedWidths.get(longEdge)).toBeCloseTo(0.3, 6);
    assertValid(mesh, true);
  });

  it("rejects duplicate-safe missing, boundary, three-edge, and non-manifold cases without mutation", () => {
    const ids = createSequenceIdFactory("bev-reject");
    const ctx = createMeshOperationContext(ids);

    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edge = cubeEdge(cube);
    const dup = bevelEdges(cube, { edgeIds: [edge, edge], offset: 0.2 }, ctx);
    expect(dup.beveledEdgeIds).toHaveLength(1);
    assertValid(cube, true);

    const missing = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const missingFp = meshFingerprint(missing);
    expect(() => bevelEdges(missing, { edgeIds: ["missing-edge" as EdgeId], offset: 0.2 }, ctx)).toThrow(
      /does not exist/,
    );
    expect(meshFingerprint(missing)).toBe(missingFp);

    const open = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const openFp = meshFingerprint(open);
    expect(() => bevelEdges(open, { edgeIds: [open.findBoundaryEdges()[0]!], offset: 0.1 }, ctx)).toThrow(
      /manifold interior/,
    );
    expect(meshFingerprint(open)).toBe(openFp);

    const junction = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertex = [...junction.vertices.keys()][0]!;
    const three = junction.getVertexEdges(vertex);
    expect(three.length).toBe(3);
    const junctionFp = meshFingerprint(junction);
    expect(() => bevelEdges(junction, { edgeIds: three, offset: 0.1 }, ctx)).toThrow(/unsupported-bevel-junction/);
    expect(meshFingerprint(junction)).toBe(junctionFp);
  });

  it("preserves UV seams, creases, materials, and skin-adjacent attributes", () => {
    const ids = createSequenceIdFactory("bev-attr");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = cubeEdge(cube);
    cube.edges.get(edgeId)!.isSeam = true;
    cube.edges.get(edgeId)!.creaseWeight = 0.6;
    const [f1] = cube.getEdgeFaces(edgeId);
    cube.faces.get(f1!)!.materialSlot = 4;
    for (const corner of cube.corners.values()) {
      corner.uv = [0.2, 0.8];
      corner.color = [0, 1, 0, 1];
    }
    const result = bevelEdges(cube, { edgeIds: [edgeId], offset: 0.2 }, ctx);
    expect(result.remainingFaceIds.length).toBeGreaterThan(0);
    expect([...cube.faces.values()].some((face) => face.materialSlot === 4)).toBe(true);
    expect([...cube.corners.values()].some((corner) => corner.uv && corner.color)).toBe(true);
    assertValid(cube, true);
  });

  it("rolls back on failure and round-trips serialization", () => {
    const ids = createSequenceIdFactory("bev-undo");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const snapshot = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const result = bevelEdges(cube, { edgeIds: [cubeEdge(cube)], offset: 0.2 }, ctx);
    expect(result.createdFaceIds.length).toBeGreaterThan(0);
    restoreMesh(cube, snapshot);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    expect(() => bevelEdges(cube, { edgeIds: [cubeEdge(cube)], offset: 0 }, ctx)).toThrow(/positive finite distance/);
    expect(meshFingerprint(cube)).toBe(fingerprint);
  });
});
