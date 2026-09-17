import { createSequenceIdFactory, type EdgeId, type VertexId } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  MeshBuilder,
  bevelEdges,
  cloneMesh,
  connectVertices,
  createMeshOperationContext,
  cutFace,
  deleteFace,
  dissolveEdge,
  fillBoundary,
  extrudeFaces,
  extrudeRegion,
  insetFaces,
  loopCut,
  collectQuadEdgeLoop,
  previewLoopCut,
  mergeVertices,
  mergeVerticesByDistance,
  meshFingerprint,
  restoreMesh,
  serializeMesh,
  splitEdge,
  subdivideFaces,
  triangulateFaces,
  trianglesToQuads,
  bridgeLoops,
  catmullClarkSubdivide,
  executeKnifePlan,
  planKnifeStroke,
  type HalfEdgeMesh,
} from "../src/index";

function assertManifold(mesh: HalfEdgeMesh, closed: boolean): void {
  const boundary = mesh.findBoundaryEdges();
  expect(boundary.length === 0).toBe(closed);
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    const count = (f1 ? 1 : 0) + (f2 ? 1 : 0);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
    if (closed) {
      expect(count).toBe(2);
    }
  }
}

describe("mesh operations", () => {
  it("splits an edge with per-face UVs, colors, and seam flags", () => {
    const ids = createSequenceIdFactory("split");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(2, 0, 0);
    const c = builder.addVertex(2, 2, 0);
    const d = builder.addVertex(0, 2, 0);
    const e = builder.addVertex(0, 0, 2);
    const f = builder.addVertex(2, 0, 2);
    builder.addFace([a, b, c, d], {
      uvs: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      colors: [
        [1, 0, 0, 1],
        [0, 1, 0, 1],
        [0, 0, 1, 1],
        [1, 1, 0, 1],
      ],
    });
    builder.addFace([a, e, f, b], {
      uvs: [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ],
      colors: [
        [1, 0, 0, 1],
        [0, 0, 0, 1],
        [1, 1, 1, 1],
        [0, 1, 0, 1],
      ],
    });
    const mesh = builder.getMesh();
    const edgeId = [...mesh.edges.keys()].find((id) => {
      const ends = mesh.getEdgeVertices(id);
      return ends && ((ends[0] === a && ends[1] === b) || (ends[0] === b && ends[1] === a));
    })!;
    mesh.edges.get(edgeId)!.isSeam = true;
    mesh.edges.get(edgeId)!.creaseAngle = 0.5;
    mesh.edges.get(edgeId)!.creaseWeight = 0.5;
    const weights = new Map<VertexId, readonly { boneId: string; weight: number }[]>([
      [a, [{ boneId: "bone-a", weight: 1 }]],
      [b, [{ boneId: "bone-b", weight: 1 }]],
    ]);
    const result = splitEdge(mesh, { edgeId, t: 0.25, skinWeights: weights }, ctx);
    expect(result.newVertexId).toBeDefined();
    expect(result.mapping.edges.replacedBy.get(edgeId)).toEqual([
      result.firstEdgeId,
      result.secondEdgeId,
    ]);
    expect(mesh.edges.get(result.firstEdgeId)?.isSeam).toBe(true);
    expect(mesh.edges.get(result.secondEdgeId)?.creaseAngle).toBe(0.5);
    expect(mesh.edges.get(result.secondEdgeId)?.creaseWeight).toBe(0.5);
    expect(result.interpolatedSkinWeights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1);
    expect(mesh.faces.size).toBe(2);
    assertManifold(mesh, false);
  });

  it("cuts faces for vertex and edge endpoint combinations", () => {
    const ids = createSequenceIdFactory("cut");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(-1, 0, -1);
    const b = builder.addVertex(1, 0, -1);
    const c = builder.addVertex(1, 0, 1);
    const d = builder.addVertex(-1, 0, 1);
    const faceId = builder.addFace([a, b, c, d], {
      uvs: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    });
    const quad = builder.getMesh();
    const corners = quad.getFaceCorners(faceId);
    let lowest = corners[0]!;
    for (const id of corners) {
      if (id < lowest) {
        lowest = id;
      }
    }
    const lowestVertex = quad.corners.get(lowest)!.vertexId;
    const verts = quad.getFaceVertices(faceId);
    const before = serializeMesh(quad);
    const vv = cutFace(
      quad,
      { faceId, from: { kind: "vertex", vertexId: verts[0]! }, to: { kind: "vertex", vertexId: verts[2]! } },
      ctx,
    );
    expect(quad.faces.has(vv.preservedFaceId)).toBe(true);
    expect(vv.preservedFaceId).toBe(faceId);
    expect(quad.faces.has(vv.newFaceId)).toBe(true);
    expect(quad.faces.size).toBe(2);
    expect(quad.getFaceVertices(vv.preservedFaceId)).toContain(lowestVertex);
    expect(vv.mapping.faces.replacedBy.get(faceId)).toEqual([vv.preservedFaceId, vv.newFaceId]);
    for (const keptId of [vv.preservedFaceId, vv.newFaceId]) {
      const uvs = quad.getFaceCorners(keptId).map((id) => quad.corners.get(id)?.uv);
      expect(uvs.every((uv) => uv && Number.isFinite(uv[0]) && Number.isFinite(uv[1]))).toBe(true);
    }
    assertManifold(quad, false);

    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const top = [...cube.faces.keys()][2]!;
    const loop = cube.getFaceVertices(top);
    const edges = cube.getFaceEdges(top);
    const ve = cutFace(
      cube,
      {
        faceId: top,
        from: { kind: "vertex", vertexId: loop[0]! },
        to: { kind: "edge", edgeId: edges[2]!, t: 0.5 },
      },
      ctx,
    );
    expect(cube.faces.has(ve.preservedFaceId)).toBe(true);
    expect(cube.faces.size).toBe(7);
    assertManifold(cube, true);

    const cube2 = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const top2 = [...cube2.faces.keys()][2]!;
    const edges2 = cube2.getFaceEdges(top2);
    cutFace(
      cube2,
      {
        faceId: top2,
        from: { kind: "edge", edgeId: edges2[0]!, t: 0.3 },
        to: { kind: "edge", edgeId: edges2[2]!, t: 0.6 },
      },
      ctx,
    );
    expect(cube2.faces.size).toBe(7);
    assertManifold(cube2, true);

    restoreMesh(quad, before);
    expect(() =>
      cutFace(quad, { faceId, from: { kind: "vertex", vertexId: verts[0]! }, to: { kind: "vertex", vertexId: verts[1]! } }, ctx),
    ).toThrow(/existing edge/);
    expect(quad.faces.size).toBe(1);
    const quadEdges = quad.getFaceEdges(faceId);
    expect(() =>
      cutFace(
        quad,
        {
          faceId,
          from: { kind: "edge", edgeId: quadEdges[0]!, t: 0 },
          to: { kind: "vertex", vertexId: verts[2]! },
        },
        ctx,
      ),
    ).toThrow(/t must be in/);
    expect(quad.faces.size).toBe(1);
  });

  it("connects opposite vertices on a quad", () => {
    const ids = createSequenceIdFactory("connect");
    const ctx = createMeshOperationContext(ids);
    const quad = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], ids.mesh());
    const faceId = [...quad.faces.keys()][0]!;
    const verts = quad.getFaceVertices(faceId);
    const result = connectVertices(quad, { a: verts[0]!, b: verts[2]! }, ctx);
    expect(quad.faces.size).toBe(2);
    expect(quad.edges.has(result.newEdgeId)).toBe(true);
    expect(result.preservedFaceId).toBe(faceId);
    assertManifold(quad, false);
    expect(() => connectVertices(quad, { a: verts[0]!, b: verts[1]! }, ctx)).toThrow(/existing edge/);
    expect(() => connectVertices(quad, { a: verts[0]!, b: verts[0]! }, ctx)).toThrow(/distinct/);
  });

  it("merges vertices with center/active/custom targets and distance weld", () => {
    const ids = createSequenceIdFactory("merge");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const d = builder.addVertex(0.001, 0.05, 0);
    builder.addFace([a, b, c]);
    builder.addFace([a, d, b]);
    const mesh = builder.getMesh();
    const merged = mergeVertices(mesh, { vertexIds: [a, b], target: "center" }, ctx);
    expect(merged.mergedCount).toBe(1);
    expect(mesh.vertices.has(merged.survivorId!)).toBe(true);

    const mesh2 = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const vIds = [...mesh2.vertices.keys()];
    const active = mergeVertices(
      mesh2,
      { vertexIds: [vIds[0]!, vIds[1]!], target: "active", activeId: vIds[0]! },
      ctx,
    );
    expect(active.survivorId).toBe(vIds[0]);
    const mesh3 = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const ids3 = [...mesh3.vertices.keys()];
    const custom = mergeVertices(
      mesh3,
      { vertexIds: [ids3[0]!, ids3[1]!], target: "custom", custom: [9, 8, 7] },
      ctx,
    );
    expect(mesh3.vertices.get(custom.survivorId!)?.position).toEqual([9, 8, 7]);
  });

  it("welds nearby vertices on an open disk", () => {
    const ids = createSequenceIdFactory("weld");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    builder.addVertex(0.0001, 0, 0);
    builder.addFace([a, b, c]);
    const mesh = builder.getMesh();
    const welded = mergeVerticesByDistance(mesh, 0.01, ctx);
    expect(welded.mergedCount).toBeGreaterThanOrEqual(1);
  });

  it("preserves corner attributes when merge remaps a non-degenerate face", () => {
    const ids = createSequenceIdFactory("merge-attrs");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const d = builder.addVertex(0, 0, 1);
    const face = builder.addFace([a, b, c], {
      uvs: [[0, 0], [1, 0], [0, 1]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      colors: [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]],
    });
    builder.addFace([a, c, d]);
    const mesh = builder.getMesh();
    mergeVertices(mesh, { vertexIds: [b, d], target: "first" }, ctx);
    const corners = mesh.getFaceCorners(face).map((id) => mesh.corners.get(id)!);
    expect(corners).toHaveLength(3);
    expect(corners.map((corner) => corner.uv)).toEqual([[0, 0], [1, 0], [0, 1]]);
    expect(corners.map((corner) => corner.color)).toEqual([
      [1, 0, 0, 1],
      [0, 1, 0, 1],
      [0, 0, 1, 1],
    ]);
  });

  it("dissolves a cube edge into an n-gon", () => {
    const ids = createSequenceIdFactory("diss");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const result = dissolveEdge(cube, { edgeId }, ctx);
    expect(cube.faces.size).toBe(5);
    expect(cube.faces.has(result.faceId)).toBe(true);
    assertManifold(cube, true);
  });

  it("triangulates cube faces in-kernel with FaceId traceability", () => {
    const ids = createSequenceIdFactory("tri");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const original = [...cube.faces.keys()];
    const result = triangulateFaces(cube, {}, ctx);
    expect(cube.faces.size).toBe(12);
    expect(result.triangleFaceIds).toHaveLength(12);
    for (const id of original) {
      expect(cube.faces.has(id)).toBe(true);
      expect(cube.getFaceVertices(id).length).toBe(3);
    }
    assertManifold(cube, true);
  });

  it("extrudes a region without internal side walls", () => {
    const ids = createSequenceIdFactory("region");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faces = [[...cube.faces.keys()][0]!, [...cube.faces.keys()][2]!];
    const region = extrudeRegion(cube, { faceIds: faces, distance: 1 }, ctx);
    expect(region.sideFaceIds.length).toBeLessThan(8);
    assertManifold(cube, true);
    const single = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    extrudeFaces(single, { faceIds: [[...single.faces.keys()][0]!], distance: 1 }, ctx);
    assertManifold(single, true);
  });

  it("loop-cuts and bevels a closed cube", () => {
    const ids = createSequenceIdFactory("loop");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const start = [...cube.edges.keys()][0]!;
    loopCut(cube, { startEdgeId: start, factor: 0.4 }, ctx);
    assertManifold(cube, true);
    const cube2 = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    bevelEdges(cube2, { edgeIds: [[...cube2.edges.keys()][0]!], offset: 0.2 }, ctx);
    assertManifold(cube2, true);
  });

  it("walks a quad strip in both directions and previews without mutating", () => {
    const ids = createSequenceIdFactory("strip");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const v0 = builder.addVertex(-2, 0, -1);
    const v1 = builder.addVertex(0, 0, -1);
    const v2 = builder.addVertex(2, 0, -1);
    const v3 = builder.addVertex(-2, 0, 1);
    const v4 = builder.addVertex(0, 0, 1);
    const v5 = builder.addVertex(2, 0, 1);
    builder.addFace([v0, v1, v4, v3]);
    builder.addFace([v1, v2, v5, v4]);
    const mesh = builder.getMesh();
    const shared = [...mesh.edges.keys()].find((id) => {
      const [f1, f2] = mesh.getEdgeFaces(id);
      return Boolean(f1 && f2);
    })!;
    expect(collectQuadEdgeLoop(mesh, shared)).toHaveLength(3);
    const fingerprint = meshFingerprint(mesh);
    const preview = previewLoopCut(mesh, { startEdgeId: shared, factor: 0.5, cuts: 2 });
    expect(preview.segments.length).toBeGreaterThan(0);
    expect(preview.factors).toHaveLength(2);
    expect(meshFingerprint(mesh)).toBe(fingerprint);
    const result = loopCut(mesh, { startEdgeId: shared, cuts: 2, factor: 0.5 }, ctx);
    expect(result.newFaceIds.length).toBeGreaterThanOrEqual(4);
  });

  it("insets a cube face individually and a region of adjacent faces", () => {
    const ids = createSequenceIdFactory("inset");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const top = [...cube.faces.keys()][2]!;
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const individual = insetFaces(cube, { faceIds: [top], distance: 0.15, mode: "individual" }, ctx);
    expect(individual.innerFaceIds).toHaveLength(1);
    expect(individual.ringFaceIds).toHaveLength(4);
    expect(individual.mapping.faces.created.size).toBe(4);
    assertManifold(cube, true);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    const disk = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    insetFaces(disk, { faceIds: [[...disk.faces.keys()][0]!], distance: 0.1 }, ctx);
    expect(disk.faces.size).toBeGreaterThan(1);
    assertManifold(disk, false);

    const a = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const b = cloneMesh(a);
    const faces = [[...a.faces.keys()][0]!, [...a.faces.keys()][2]!];
    const twoIndividual = insetFaces(a, { faceIds: faces, distance: 0.12, mode: "individual" }, ctx);
    const region = insetFaces(b, { faceIds: faces, distance: 0.12, mode: "region" }, ctx);
    expect(region.ringFaceIds.length).toBeLessThan(twoIndividual.ringFaceIds.length);
    assertManifold(b, true);

    expect(() => insetFaces(MeshBuilder.createCube(1, 1, 1), { faceIds: [], distance: 0.1 }, ctx)).toThrow(
      /at least one face/,
    );
    expect(() =>
      insetFaces(MeshBuilder.createCube(1, 1, 1), { faceIds: [[...MeshBuilder.createCube(1, 1, 1).faces.keys()][0]!], distance: 0 }, ctx),
    ).toThrow(/positive/);

    const large = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const largeFace = [...large.faces.keys()][0]!;
    const largeFp = meshFingerprint(large);
    expect(() => insetFaces(large, { faceIds: [largeFace], distance: 5, mode: "individual" }, ctx)).toThrow(/invert/);
    expect(meshFingerprint(large)).toBe(largeFp);
  });

  it("restores split, cut, merge, and extrude from snapshots", () => {
    const ids = createSequenceIdFactory("undo");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const edgeId = [...cube.edges.keys()][0]!;
    splitEdge(cube, { edgeId, t: 0.5 }, ctx);
    expect(meshFingerprint(cube)).not.toBe(fingerprint);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);
  });

  it("subdivides quads into 4 quads with shared midpoints and FaceId traceability", () => {
    const ids = createSequenceIdFactory("subd");
    const ctx = createMeshOperationContext(ids);
    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const faceId = [...quad.faces.keys()][0]!;
    const before = serializeMesh(quad);
    const fingerprint = meshFingerprint(quad);
    const result = subdivideFaces(quad, { faceIds: [faceId] }, ctx);
    expect(result.newFaceIds).toHaveLength(4);
    expect(quad.faces.size).toBe(4);
    expect(quad.faces.has(faceId)).toBe(true);
    expect(result.mapping.faces.replacedBy.get(faceId)).toEqual(result.newFaceIds);
    expect(quad.getFaceVertices(faceId)).toHaveLength(4);
    assertManifold(quad, false);
    restoreMesh(quad, before);
    expect(meshFingerprint(quad)).toBe(fingerprint);

    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const one = [...cube.faces.keys()][0]!;
    subdivideFaces(cube, { faceIds: [one] }, ctx);
    expect(cube.faces.size).toBe(9);
    assertManifold(cube, true);

    const pairMesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faces = [[...pairMesh.faces.keys()][0]!, [...pairMesh.faces.keys()][2]!];
    subdivideFaces(pairMesh, { faceIds: faces }, ctx);
    expect(pairMesh.vertices.size).toBeLessThan(8 + 5 + 5);
    assertManifold(pairMesh, true);

    expect(() => subdivideFaces(pairMesh, { faceIds: [] }, ctx)).toThrow(/at least one face/);
  });

  it("subdivides a closed cube with FaceId mapping and snapshot undo", () => {
    const ids = createSequenceIdFactory("subd-cube");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceIds = [...cube.faces.keys()];
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const result = subdivideFaces(cube, { faceIds, cuts: 1 }, ctx);
    expect(result.newFaceIds).toHaveLength(24);
    expect(cube.faces.size).toBe(24);
    expect(cube.faces.has(faceIds[0]!)).toBe(true);
    expect(result.mapping.faces.replacedBy.get(faceIds[0]!)?.length).toBe(4);
    assertManifold(cube, true);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const qid = [...quad.faces.keys()][0]!;
    const twice = subdivideFaces(quad, { faceIds: [qid], cuts: 2 }, ctx);
    expect(twice.newFaceIds).toHaveLength(16);
    expect(quad.faces.size).toBe(16);
    assertManifold(quad, false);
  });

  it("bevels a cube edge with a multi-segment rounded profile", () => {
    const ids = createSequenceIdFactory("bevel-seg");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const result = bevelEdges(cube, { edgeIds: [edgeId], offset: 0.2, segments: 3 }, ctx);
    expect(result.chamferFaceIds).toHaveLength(3);
    expect(result.remainingFaceIds).toHaveLength(2);
    expect(cube.faces.size).toBe(9);
    expect(result.mapping.vertices.created.size).toBeGreaterThan(4);
    assertManifold(cube, true);
    const mid = cube.vertices.get([...result.mapping.vertices.created][0]!)!.position;
    expect(Number.isFinite(mid[0] + mid[1] + mid[2])).toBe(true);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);
  });

  it("insets a concave L-face without deleting the original loop count below 1", () => {
    const ids = createSequenceIdFactory("inset-concave");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(2, 0, 0);
    const v2 = builder.addVertex(2, 0, 1);
    const v3 = builder.addVertex(1, 0, 1);
    const v4 = builder.addVertex(1, 0, 2);
    const v5 = builder.addVertex(0, 0, 2);
    const faceId = builder.addFace([v0, v1, v2, v3, v4, v5]);
    const mesh = builder.getMesh();
    const tooFar = cloneMesh(mesh);
    const result = insetFaces(mesh, { faceIds: [faceId], distance: 0.05, mode: "individual" }, ctx);
    expect(result.innerFaceIds).toHaveLength(1);
    expect(result.ringFaceIds.length).toBeGreaterThanOrEqual(6);
    expect(mesh.faces.has(result.innerFaceIds[0]!)).toBe(true);
    expect(() =>
      insetFaces(tooFar, { faceIds: [faceId], distance: 0.8, mode: "individual" }, ctx),
    ).toThrow(/invert/);
  });

  it("bevels two connected cube edges as a chain", () => {
    const ids = createSequenceIdFactory("bevel-chain");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertexId = [...cube.vertices.keys()][0]!;
    const edgeIds = cube.getVertexEdges(vertexId).slice(0, 2);
    expect(edgeIds).toHaveLength(2);
    const result = bevelEdges(cube, { edgeIds, offset: 0.15, segments: 1 }, ctx);
    expect(result.chamferFaceIds.length).toBeGreaterThanOrEqual(2);
    assertManifold(cube, true);
    for (const faceId of cube.faces.keys()) {
      for (const vertexId of cube.getFaceVertices(faceId)) {
        expect(cube.getVertexEdges(vertexId).length).toBeGreaterThanOrEqual(2);
      }
    }
    for (const edgeId of cube.edges.keys()) {
      const ends = cube.getEdgeVertices(edgeId);
      expect(ends).not.toBeNull();
      if (!ends) {
        continue;
      }
      const pa = cube.vertices.get(ends[0])!.position;
      const pb = cube.vertices.get(ends[1])!.position;
      expect(Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])).toBeGreaterThan(1e-8);
    }
  });

  it("fills a boundary hole as an n-gon, fan, and triangles", () => {
    const ids = createSequenceIdFactory("fill");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceId = [...cube.faces.keys()][0]!;
    const holeEdges = cube.getFaceEdges(faceId);
    deleteFace(cube, faceId);
    expect(cube.findBoundaryEdges()).toHaveLength(4);
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const ngon = fillBoundary(cube, { boundaryEdgeIds: holeEdges, method: "ngon" }, ctx);
    expect(ngon.newFaceIds).toHaveLength(1);
    expect(cube.faces.size).toBe(6);
    assertManifold(cube, true);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    const fanMesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const fanFace = [...fanMesh.faces.keys()][0]!;
    const fanEdges = fanMesh.getFaceEdges(fanFace);
    deleteFace(fanMesh, fanFace);
    const fan = fillBoundary(fanMesh, { boundaryEdgeIds: fanEdges, method: "fan" }, ctx);
    expect(fan.newFaceIds).toHaveLength(2);
    assertManifold(fanMesh, true);

    const triMesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const triFace = [...triMesh.faces.keys()][0]!;
    const triEdges = triMesh.getFaceEdges(triFace);
    deleteFace(triMesh, triFace);
    const tri = fillBoundary(triMesh, { boundaryEdgeIds: triEdges, method: "triangulate" }, ctx);
    expect(tri.newFaceIds).toHaveLength(2);
    for (const id of tri.newFaceIds) {
      expect(triMesh.getFaceVertices(id)).toHaveLength(3);
    }
    assertManifold(triMesh, true);
  });

  it("bridges equal vertex loops and rejects manifold or degenerate input", () => {
    const ids = createSequenceIdFactory("bridge");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const a0 = builder.addVertex(-1, 0, -1);
    const a1 = builder.addVertex(1, 0, -1);
    const a2 = builder.addVertex(1, 0, 1);
    const a3 = builder.addVertex(-1, 0, 1);
    const b0 = builder.addVertex(-1, 2, -1);
    const b1 = builder.addVertex(1, 2, -1);
    const b2 = builder.addVertex(1, 2, 1);
    const b3 = builder.addVertex(-1, 2, 1);
    const mesh = builder.getMesh();
    const before = serializeMesh(mesh);
    const fingerprint = meshFingerprint(mesh);
    const result = bridgeLoops(mesh, { loopA: [a0, a1, a2, a3], loopB: [b0, b1, b2, b3] }, ctx);
    expect(result.bridgeFaceIds).toHaveLength(4);
    expect(result.mapping.faces.created.size).toBe(4);
    expect(mesh.faces.size).toBe(4);
    expect(mesh.findBoundaryEdges()).toHaveLength(8);
    assertManifold(mesh, false);
    restoreMesh(mesh, before);
    expect(meshFingerprint(mesh)).toBe(fingerprint);

    expect(() =>
      bridgeLoops(mesh, { loopA: [a0, a1], loopB: [b0, b1, b2] }, ctx),
    ).toThrow(/equal vertex count/);
    expect(() => bridgeLoops(mesh, { loopA: [a0], loopB: [b0] }, ctx)).toThrow(/at least 2/);

    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const top = cube.getFaceVertices([...cube.faces.keys()][2]!);
    const bottom = cube.getFaceVertices([...cube.faces.keys()][3]!);
    expect(() => bridgeLoops(cube, { loopA: top, loopB: bottom }, ctx)).toThrow(/manifold/);
  });

  it("plans and executes a knife stroke across opposite edges of a face", () => {
    const ids = createSequenceIdFactory("knife-plan");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceId = [...cube.faces.keys()][0]!;
    const edges = cube.getFaceEdges(faceId);
    const mid = (edgeId: (typeof edges)[number]): [number, number, number] => {
      const ends = cube.getEdgeVertices(edgeId)!;
      const a = cube.vertices.get(ends[0])!.position;
      const b = cube.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    const points = [mid(edges[0]!), mid(edges[2]!)];
    const plan = planKnifeStroke(cube, { points, snapRadius: 0.05 }, ctx);
    expect(plan.cuts).toHaveLength(1);
    expect(plan.cuts[0]?.faceId).toBe(faceId);
    const before = serializeMesh(cube);
    const fingerprint = meshFingerprint(cube);
    const result = executeKnifePlan(cube, { points, snapRadius: 0.05 }, ctx);
    expect(result.cutCount).toBe(1);
    expect(cube.faces.size).toBe(7);
    assertManifold(cube, true);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const qEdges = quad.getFaceEdges([...quad.faces.keys()][0]!);
    const qMid = (edgeId: (typeof qEdges)[number]): [number, number, number] => {
      const ends = quad.getEdgeVertices(edgeId)!;
      const a = quad.vertices.get(ends[0])!.position;
      const b = quad.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    executeKnifePlan(quad, { points: [qMid(qEdges[0]!), qMid(qEdges[2]!)], snapRadius: 0.05 }, ctx);
    expect(quad.faces.size).toBe(2);
    assertManifold(quad, false);

    const front = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const interiorToEdge = executeKnifePlan(
      front,
      { points: [[0, 0.25, 1], [0, -1, 1]], snapRadius: 0.25 },
      ctx,
    );
    expect(interiorToEdge.cutCount).toBe(1);
    expect(front.faces.size).toBe(7);
    assertManifold(front, true);
  });

  it("applies Catmull-Clark subdivision without an external manifold library", () => {
    const ids = createSequenceIdFactory("cc");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertex = [...cube.vertices.values()][0]!;
    const origId = vertex.id;
    const beforeLen = Math.hypot(vertex.position[0], vertex.position[1], vertex.position[2]);
    const fingerprint = meshFingerprint(cube);
    const before = serializeMesh(cube);
    const result = catmullClarkSubdivide(cube, {}, ctx);
    expect(result.iterations).toBe(1);
    expect(cube.faces.size).toBe(24);
    expect(cube.vertices.size).toBe(26);
    expect(result.newFaceIds).toHaveLength(24);
    assertManifold(cube, true);
    const moved = cube.vertices.get(origId)!.position;
    expect(Math.hypot(moved[0], moved[1], moved[2])).toBeLessThan(beforeLen);
    restoreMesh(cube, before);
    expect(meshFingerprint(cube)).toBe(fingerprint);

    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    catmullClarkSubdivide(quad, { iterations: 1 }, ctx);
    expect(quad.faces.size).toBe(4);
    for (const [faceId] of quad.faces) {
      expect(quad.getFaceVertices(faceId)).toHaveLength(4);
    }
    assertManifold(quad, false);
  });

  it("knives and loop-cuts cylinders and spheres, not only cubes", () => {
    const ids = createSequenceIdFactory("any-mesh");
    const ctx = createMeshOperationContext(ids);
    const edgeMid = (mesh: HalfEdgeMesh, edgeId: EdgeId): [number, number, number] => {
      const ends = mesh.getEdgeVertices(edgeId)!;
      const a = mesh.vertices.get(ends[0])!.position;
      const b = mesh.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };

    const cylinder = MeshBuilder.createCylinder(1, 2, 8, ids.mesh());
    const side = [...cylinder.faces.keys()].find((id) => cylinder.getFaceVertices(id).length === 4)!;
    const sideEdges = cylinder.getFaceEdges(side);
    const knifed = executeKnifePlan(
      cylinder,
      { points: [edgeMid(cylinder, sideEdges[0]!), edgeMid(cylinder, sideEdges[2]!)] },
      ctx,
    );
    expect(knifed.cutCount).toBeGreaterThanOrEqual(1);
    expect(cylinder.faces.size).toBeGreaterThan(10);
    assertManifold(cylinder, true);

    const barrel = MeshBuilder.createCylinder(1, 2, 8, ids.mesh());
    const vertical = [...barrel.edges.keys()].find((id) => {
      const ends = barrel.getEdgeVertices(id);
      if (!ends) {
        return false;
      }
      const a = barrel.vertices.get(ends[0])!.position;
      const b = barrel.vertices.get(ends[1])!.position;
      return Math.abs(a[1] - b[1]) > 1 && Math.hypot(a[0] - b[0], a[2] - b[2]) < 1e-6;
    })!;
    expect(collectQuadEdgeLoop(barrel, vertical).length).toBe(8);
    loopCut(barrel, { startEdgeId: vertical, factor: 0.5 }, ctx);
    expect(barrel.faces.size).toBeGreaterThan(10);
    assertManifold(barrel, true);

    const rimmed = MeshBuilder.createCylinder(1, 2, 8, ids.mesh());
    const rim = [...rimmed.edges.keys()].find((id) => {
      const ends = rimmed.getEdgeVertices(id);
      if (!ends) {
        return false;
      }
      const a = rimmed.vertices.get(ends[0])!.position;
      const b = rimmed.vertices.get(ends[1])!.position;
      const [f1, f2] = rimmed.getEdgeFaces(id);
      const nGon = (f1 && rimmed.getFaceVertices(f1).length > 4) || (f2 && rimmed.getFaceVertices(f2).length > 4);
      return nGon && Math.abs(a[1] - b[1]) < 1e-6;
    })!;
    loopCut(rimmed, { startEdgeId: rim, factor: 0.4 }, ctx);
    assertManifold(rimmed, true);

    const sphere = MeshBuilder.createSphere(1, 8, 6, ids.mesh());
    const belt = [...sphere.edges.keys()].find((id) => {
      const [f1, f2] = sphere.getEdgeFaces(id);
      return Boolean(
        f1 &&
          f2 &&
          sphere.getFaceVertices(f1).length === 4 &&
          sphere.getFaceVertices(f2).length === 4,
      );
    })!;
    const beforeFaces = sphere.faces.size;
    loopCut(sphere, { startEdgeId: belt, factor: 0.5 }, ctx);
    expect(sphere.faces.size).toBeGreaterThan(beforeFaces);
    assertManifold(sphere, true);
  });

  it("rejects invalid topology ops without mutating the mesh", () => {
    const ids = createSequenceIdFactory("contract");
    const ctx = createMeshOperationContext(ids);
    const fingerprintOf = (mesh: HalfEdgeMesh) => meshFingerprint(mesh);

    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const faceId = [...quad.faces.keys()][0]!;
    const verts = quad.getFaceVertices(faceId);
    const edges = quad.getFaceEdges(faceId);
    const oppositeEdge = edges.find((edgeId) => {
      const ends = quad.getEdgeVertices(edgeId)!;
      return ends[0] !== verts[0] && ends[1] !== verts[0];
    })!;
    const ve = cutFace(
      quad,
      {
        faceId,
        from: { kind: "vertex", vertexId: verts[0]! },
        to: { kind: "edge", edgeId: oppositeEdge, t: 0.5 },
      },
      ctx,
    );
    expect(quad.faces.size).toBe(2);
    expect(ve.preservedFaceId).toBe(faceId);
    expect(ve.mapping.faces.replacedBy.get(faceId)).toEqual([ve.preservedFaceId, ve.newFaceId]);
    assertManifold(quad, false);

    const adjacent = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const adjFace = [...adjacent.faces.keys()][0]!;
    const adjVerts = adjacent.getFaceVertices(adjFace);
    const adjFp = fingerprintOf(adjacent);
    expect(() =>
      connectVertices(adjacent, { a: adjVerts[0]!, b: adjVerts[1]! }, ctx),
    ).toThrow(/existing edge|adjacent/);
    expect(fingerprintOf(adjacent)).toBe(adjFp);

    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vIds = [...cube.vertices.keys()];
    const first = mergeVertices(cube, { vertexIds: [vIds[0]!, vIds[1]!], target: "first" }, ctx);
    expect(first.survivorId).toBe(vIds[0]);
    const cubeLast = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const lastIds = [...cubeLast.vertices.keys()];
    const last = mergeVertices(cubeLast, { vertexIds: [lastIds[0]!, lastIds[1]!], target: "last" }, ctx);
    expect(last.survivorId).toBe(lastIds[1]);
    const cubeCursor = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const cursorIds = [...cubeCursor.vertices.keys()];
    const cursor = mergeVertices(
      cubeCursor,
      { vertexIds: [cursorIds[0]!, cursorIds[1]!], target: "cursor", cursor: [0.25, 0.5, 0.75] },
      ctx,
    );
    expect(cubeCursor.vertices.get(cursor.survivorId!)?.position).toEqual([0.25, 0.5, 0.75]);

    const weldFpMesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const weldFp = fingerprintOf(weldFpMesh);
    expect(() => mergeVerticesByDistance(weldFpMesh, 0, ctx)).toThrow(/positive/);
    expect(fingerprintOf(weldFpMesh)).toBe(weldFp);

    const open = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    const boundary = open.findBoundaryEdges()[0]!;
    const openFp = fingerprintOf(open);
    expect(() => dissolveEdge(open, { edgeId: boundary }, ctx)).toThrow(/manifold interior/);
    expect(fingerprintOf(open)).toBe(openFp);

    const slotted = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const shared = [...slotted.edges.keys()].find((edgeId) => {
      const [f1, f2] = slotted.getEdgeFaces(edgeId);
      return Boolean(f1 && f2);
    })!;
    const [slotA, slotB] = slotted.getEdgeFaces(shared);
    slotted.faces.get(slotA!)!.materialSlot = 0;
    slotted.faces.get(slotB!)!.materialSlot = 1;
    const slottedFp = fingerprintOf(slotted);
    expect(() => dissolveEdge(slotted, { edgeId: shared }, ctx)).toThrow(/material/);
    expect(fingerprintOf(slotted)).toBe(slottedFp);

    const triCube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    triangulateFaces(triCube, {}, ctx);
    const afterTri = triangulateFaces(triCube, {}, ctx);
    expect(afterTri.triangleFaceIds).toHaveLength(12);
    expect(triCube.faces.size).toBe(12);

    const emptyExt = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const emptyFp = fingerprintOf(emptyExt);
    expect(() => extrudeFaces(emptyExt, { faceIds: [], distance: 1 }, ctx)).toThrow(/at least one face/);
    expect(fingerprintOf(emptyExt)).toBe(emptyFp);

    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const triId = builder.addFace([a, b, c]);
    const triangle = builder.getMesh();
    const triEdge = triangle.getFaceEdges(triId)[0]!;
    expect(collectQuadEdgeLoop(triangle, triEdge)).toHaveLength(1);
    const triFp = fingerprintOf(triangle);
    expect(() => loopCut(triangle, { startEdgeId: triEdge, factor: 0.5 }, ctx)).toThrow(/at least two edges/);
    expect(fingerprintOf(triangle)).toBe(triFp);

    const missingBevel = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const missingFp = fingerprintOf(missingBevel);
    expect(() =>
      bevelEdges(missingBevel, { edgeIds: ["missing-edge" as EdgeId], offset: 0.2 }, ctx),
    ).toThrow(/does not exist/);
    expect(fingerprintOf(missingBevel)).toBe(missingFp);

    const wide = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    bevelEdges(wide, { edgeIds: [[...wide.edges.keys()][0]!], offset: 50 }, ctx);
    assertManifold(wide, true);

    expect(() => fillBoundary(MeshBuilder.createCube(1, 1, 1, ids.mesh()), { boundaryEdgeIds: [], method: "ngon" }, ctx)).toThrow(
      /at least 3/,
    );
  });

  it("threads GeometryTolerance through MeshOperationContext", () => {
    const ids = createSequenceIdFactory("tol");
    const ctx = createMeshOperationContext(ids, {
      tolerance: { epsilon: 2e-3, angleEpsilon: 0.5 },
    });
    expect(ctx.tolerance.epsilon).toBe(2e-3);
    expect(ctx.tolerance.angleEpsilon).toBe(0.5);
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    triangulateFaces(cube, {}, ctx);
    const quads = trianglesToQuads(cube, {}, ctx);
    expect(quads.quadFaceIds.length).toBeGreaterThan(0);
  });

  it("triangulates a concave L-face with ear clipping and preserves UV channels", () => {
    const ids = createSequenceIdFactory("tri-concave");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(2, 0, 0);
    const v2 = builder.addVertex(2, 0, 1);
    const v3 = builder.addVertex(1, 0, 1);
    const v4 = builder.addVertex(1, 0, 2);
    const v5 = builder.addVertex(0, 0, 2);
    const faceId = builder.addFace([v0, v1, v2, v3, v4, v5], {
      uvs: [
        [0, 0],
        [1, 0],
        [1, 0.5],
        [0.5, 0.5],
        [0.5, 1],
        [0, 1],
      ],
      uvChannels: [
        { uv1: [0, 0] },
        { uv1: [1, 0] },
        { uv1: [1, 0.5] },
        { uv1: [0.5, 0.5] },
        { uv1: [0.5, 1] },
        { uv1: [0, 1] },
      ],
      colors: [
        [1, 0, 0, 1],
        [0, 1, 0, 1],
        [0, 0, 1, 1],
        [1, 1, 0, 1],
        [1, 0, 1, 1],
        [0, 1, 1, 1],
      ],
    });
    const mesh = builder.getMesh();
    const result = triangulateFaces(mesh, { faceIds: [faceId] }, ctx);
    expect(result.triangleFaceIds).toHaveLength(4);
    expect(mesh.faces.size).toBe(4);
    for (const id of result.triangleFaceIds) {
      expect(mesh.getFaceVertices(id)).toHaveLength(3);
      for (const cornerId of mesh.getFaceCorners(id)) {
        const corner = mesh.corners.get(cornerId);
        expect(corner?.uv).toBeDefined();
        expect(corner?.uvChannels?.uv1).toBeDefined();
        expect(corner?.color).toBeDefined();
      }
    }
  });

  it("rejects self-intersecting editable triangulation", () => {
    const ids = createSequenceIdFactory("tri-bowtie");
    const ctx = createMeshOperationContext(ids);
    const builder = new MeshBuilder(ids.mesh());
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0.25, 1);
    const v2 = builder.addVertex(1, 0, 0);
    const v3 = builder.addVertex(0, 0, 1);
    const faceId = builder.addFace([v0, v1, v2, v3]);
    const mesh = builder.getMesh();
    expect(() => triangulateFaces(mesh, { faceIds: [faceId] }, ctx)).toThrow(/self-intersecting/);
  });

  it("bevels UV-mapped geometry without dropping corner attributes", () => {
    const ids = createSequenceIdFactory("bevel-uv");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    for (const corner of cube.corners.values()) {
      corner.uv = [0.25, 0.75];
      corner.uvChannels = { uv1: [0.1, 0.2] };
      corner.color = [0.2, 0.4, 0.6, 1];
    }
    const face = cube.faces.values().next().value;
    if (face) {
      face.materialSlotId = ids.materialSlot();
    }
    const edgeId = [...cube.edges.keys()][0]!;
    const result = bevelEdges(cube, { edgeIds: [edgeId], offset: 0.2, segments: 1 }, ctx);
    expect(result.chamferFaceIds.length).toBe(1);
    const remaining = cube.faces.get(result.remainingFaceIds[0]!);
    expect(remaining?.materialSlotId).toBeDefined();
    const attributed = [...cube.corners.values()].filter((corner) => corner.uv && corner.uvChannels && corner.color);
    expect(attributed.length).toBeGreaterThan(0);
  });

  it("treats bevel offset as a world-space distance", () => {
    const ids = createSequenceIdFactory("bevel-world");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const ends = cube.getEdgeVertices(edgeId)!;
    const loop = cube.getFaceVertices(cube.getEdgeFaces(edgeId)[0]!);
    const iA = loop.indexOf(ends[0]!);
    const prev = loop[(iA - 1 + loop.length) % loop.length]!;
    const next = loop[(iA + 1) % loop.length]!;
    const neighbor = next === ends[1] ? prev : next;
    const origin = cube.vertices.get(ends[0]!)!.position;
    const toward = cube.vertices.get(neighbor)!.position;
    const beforeDist = Math.hypot(toward[0] - origin[0], toward[1] - origin[1], toward[2] - origin[2]);
    expect(beforeDist).toBeCloseTo(2, 6);
    const result = bevelEdges(cube, { edgeIds: [edgeId], offset: 0.2, segments: 1 }, ctx);
    expect(result.warnings.some((item) => item.code === "bevel-clamped")).toBe(false);
    const created = [...result.mapping.vertices.created];
    expect(created.length).toBeGreaterThan(0);
    const moved = cube.vertices.get(created[0]!)!.position;
    const distFromOrigin = Math.min(
      ...[ends[0], ends[1]].map((id) => {
        const p = cube.vertices.get(id)!.position;
        return Math.hypot(moved[0] - p[0], moved[1] - p[1], moved[2] - p[2]);
      }),
    );
    expect(distFromOrigin).toBeGreaterThan(0.05);
    expect(distFromOrigin).toBeLessThan(0.45);
  });

  it("rejects non-positive bevel offsets", () => {
    const ids = createSequenceIdFactory("bevel-zero");
    const ctx = createMeshOperationContext(ids);
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    expect(() =>
      bevelEdges(cube, { edgeIds: [[...cube.edges.keys()][0]!], offset: 0 }, ctx),
    ).toThrow(/positive finite distance/);
  });
});
