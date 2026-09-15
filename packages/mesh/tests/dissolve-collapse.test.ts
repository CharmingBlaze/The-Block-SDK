import { createSequenceIdFactory, brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  MeshBuilder,
  collapseEdge,
  createMeshOperationContext,
  dissolveFace,
  dissolveVertex,
  faceNormal,
  meshFingerprint,
  reverseFaceWinding,
} from "../src/index";

function grid2x2() {
  const builder = new MeshBuilder();
  const v: ReturnType<typeof builder.addVertex>[][] = [];
  for (let z = 0; z < 3; z++) {
    const row: ReturnType<typeof builder.addVertex>[] = [];
    for (let x = 0; x < 3; x++) {
      row.push(builder.addVertex(x, 0, z));
    }
    v.push(row);
  }
  const faces = [
    builder.addFace([v[0]![0]!, v[0]![1]!, v[1]![1]!, v[1]![0]!]),
    builder.addFace([v[0]![1]!, v[0]![2]!, v[1]![2]!, v[1]![1]!]),
    builder.addFace([v[1]![0]!, v[1]![1]!, v[2]![1]!, v[2]![0]!]),
    builder.addFace([v[1]![1]!, v[1]![2]!, v[2]![2]!, v[2]![1]!]),
  ];
  return { mesh: builder.getMesh(), faces };
}

describe("dissolveVertex / dissolveFace / collapseEdge / reverseFaceWinding", () => {
  it("dissolves a cube corner into a triangle fill", () => {
    const ids = createSequenceIdFactory("dv");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertexId = [...mesh.vertices.keys()][0]!;
    const result = dissolveVertex(mesh, { vertexId }, ctx);
    expect(mesh.vertices.has(vertexId)).toBe(false);
    expect(result.fillFaceId).not.toBeNull();
    expect(mesh.faces.has(result.fillFaceId!)).toBe(true);
    expect(mesh.getFaceVertices(result.fillFaceId!).length).toBe(3);
    expect(mesh.vertices.size).toBe(7);
    expect(result.mapping.vertices.deleted.has(vertexId)).toBe(true);
  });

  it("collapses a cube edge to the midpoint", () => {
    const ids = createSequenceIdFactory("ce");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...mesh.edges.keys()][0]!;
    const ends = mesh.getEdgeVertices(edgeId)!;
    const result = collapseEdge(mesh, { edgeId }, ctx);
    expect(result.survivorId).toBeTruthy();
    expect(mesh.vertices.size).toBe(7);
    expect([ends[0], ends[1]].filter((id) => mesh.vertices.has(id))).toHaveLength(1);
  });

  it("dissolves a 2x2 grid corner region into one n-gon plus remainder", () => {
    const ids = createSequenceIdFactory("df");
    const ctx = createMeshOperationContext(ids);
    const { mesh, faces } = grid2x2();
    const result = dissolveFace(mesh, { faceId: faces[0]! }, ctx);
    expect(mesh.faces.has(faces[0]!)).toBe(false);
    expect(mesh.faces.has(result.faceId)).toBe(true);
    expect(mesh.faces.size).toBe(2);
    expect(mesh.getFaceVertices(result.faceId).length).toBeGreaterThanOrEqual(4);
  });

  it("rejects dissolving a cube face that would duplicate the opposite face", () => {
    const ids = createSequenceIdFactory("dfc");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const faceId = [...mesh.faces.keys()][0]!;
    const fingerprint = meshFingerprint(mesh);
    expect(() => dissolveFace(mesh, { faceId }, ctx)).toThrow(/duplicate|entire mesh/);
    expect(meshFingerprint(mesh)).toBe(fingerprint);
  });

  it("reverses winding and flips a cube face normal", () => {
    const ids = createSequenceIdFactory("rw");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceId = [...mesh.faces.keys()].find((id) => faceNormal(mesh, id).z > 0.9)!;
    const before = faceNormal(mesh, faceId);
    reverseFaceWinding(mesh, { faceIds: [faceId] }, ctx);
    const after = faceNormal(mesh, faceId);
    expect(after.z).toBeCloseTo(-before.z, 5);
    expect(mesh.faces.has(faceId)).toBe(true);
  });

  it("rejects unknown ids without mutation", () => {
    const ids = createSequenceIdFactory("bad");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const fingerprint = meshFingerprint(mesh);
    expect(() =>
      dissolveVertex(mesh, { vertexId: brand("missing") }, ctx),
    ).toThrow(/does not exist/);
    expect(() => collapseEdge(mesh, { edgeId: brand("missing") }, ctx)).toThrow(/does not exist/);
    expect(() =>
      reverseFaceWinding(mesh, { faceIds: [brand("missing")] }, ctx),
    ).toThrow(/does not exist/);
    expect(meshFingerprint(mesh)).toBe(fingerprint);
  });
});
