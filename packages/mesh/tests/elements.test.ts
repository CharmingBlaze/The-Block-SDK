import { createSequenceIdFactory, brand, type FaceId } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { validateMesh } from "../../validation/src/index.ts";
import {
  MeshBuilder,
  addEdge,
  addFace,
  addVertex,
  cloneMesh,
  createMeshOperationContext,
  deleteEdges,
  deleteFaces,
  deleteVertices,
  meshFingerprint,
  type HalfEdgeMesh,
} from "../src/index";

function expectNoDanglingRefs(mesh: HalfEdgeMesh): void {
  for (const he of mesh.halfEdges.values()) {
    expect(mesh.vertices.has(he.origin)).toBe(true);
    expect(mesh.edges.has(he.edgeId)).toBe(true);
    if (he.twin) {
      expect(mesh.halfEdges.has(he.twin)).toBe(true);
    }
    if (he.face) {
      expect(mesh.faces.has(he.face)).toBe(true);
    }
    if (he.corner) {
      expect(mesh.corners.has(he.corner)).toBe(true);
    }
  }
  for (const face of mesh.faces.values()) {
    expect(mesh.halfEdges.has(face.halfEdge)).toBe(true);
  }
}

describe("public element operators", () => {
  it("adds a vertex and a triangle face with mapping deltas", () => {
    const ids = createSequenceIdFactory("el");
    const ctx = createMeshOperationContext(ids);
    const mesh = new MeshBuilder(ids.mesh()).getMesh();
    const a = addVertex(mesh, { position: [0, 0, 0] }, ctx).vertexId;
    const b = addVertex(mesh, { position: [1, 0, 0] }, ctx).vertexId;
    const c = addVertex(mesh, { position: [0, 1, 0] }, ctx).vertexId;
    const added = addFace(mesh, { vertexIds: [a, b, c] }, ctx);
    expect(added.faceId).toBeTruthy();
    expect(added.changes.faceCountDelta).toBe(1);
    expect(added.mapping.faces.created.has(added.faceId)).toBe(true);
    expect(added.changes.vertexCountDelta).toBe(0);
    expectNoDanglingRefs(mesh);
    const report = validateMesh(mesh);
    expect(report.valid).toBe(true);
  });

  it("adds a wire edge and rejects duplicates", () => {
    const ids = createSequenceIdFactory("ee");
    const ctx = createMeshOperationContext(ids);
    const mesh = new MeshBuilder(ids.mesh()).getMesh();
    const a = addVertex(mesh, { position: [0, 0, 0] }, ctx).vertexId;
    const b = addVertex(mesh, { position: [2, 0, 0] }, ctx).vertexId;
    const edge = addEdge(mesh, { a, b }, ctx);
    expect(mesh.edges.has(edge.edgeId)).toBe(true);
    expect(mesh.getEdgeVertices(edge.edgeId)).toEqual([a, b]);
    expect(() => addEdge(mesh, { a, b }, ctx)).toThrow(/duplicate/);
  });

  it("deletes one cube face and records mapping", () => {
    const ids = createSequenceIdFactory("df");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faceId = [...mesh.faces.keys()][0]!;
    const result = deleteFaces(mesh, { faceIds: [faceId] }, ctx);
    expect(mesh.faces.size).toBe(5);
    expect(result.mapping.faces.deleted.has(faceId)).toBe(true);
    expect(result.mapping.faces.created.has(faceId)).toBe(false);
    expectNoDanglingRefs(mesh);
    const report = validateMesh(mesh);
    expect(report.errors.filter((e) => e.code === "DANGLING_HALF_EDGE")).toHaveLength(0);
  });

  it("deletes a cube corner and drops incident faces", () => {
    const ids = createSequenceIdFactory("dv");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertexId = [...mesh.vertices.keys()][0]!;
    deleteVertices(mesh, { vertexIds: [vertexId] }, ctx);
    expect(mesh.vertices.has(vertexId)).toBe(false);
    expect(mesh.faces.size).toBeLessThan(6);
    for (const face of mesh.faces.keys()) {
      expect(mesh.getFaceVertices(face).includes(vertexId)).toBe(false);
    }
    expectNoDanglingRefs(mesh);
    const report = validateMesh(mesh);
    expect(report.errors.filter((e) => e.code === "DANGLING_HALF_EDGE")).toHaveLength(0);
  });

  it("deletes a shared cube edge and both incident faces", () => {
    const ids = createSequenceIdFactory("de");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...mesh.edges.keys()][0]!;
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    const result = deleteEdges(mesh, { edgeIds: [edgeId] }, ctx);
    expect(mesh.edges.has(edgeId)).toBe(false);
    if (f1) {
      expect(result.mapping.faces.deleted.has(f1)).toBe(true);
    }
    if (f2) {
      expect(result.mapping.faces.deleted.has(f2)).toBe(true);
    }
  });

  it("rejects unknown ids without mutation", () => {
    const ids = createSequenceIdFactory("bad");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const fingerprint = meshFingerprint(mesh);
    expect(() =>
      deleteFaces(mesh, { faceIds: [brand<string, "FaceId">("missing")] }, ctx),
    ).toThrow(/does not exist/);
    expect(meshFingerprint(mesh)).toBe(fingerprint);
    const clone = cloneMesh(mesh);
    expect(clone.faces.size).toBe(mesh.faces.size);
  });

  it("keeps created and deleted face ids disjoint on deleteFaces", () => {
    const ids = createSequenceIdFactory("dis");
    const ctx = createMeshOperationContext(ids);
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const faceId = [...mesh.faces.keys()][0]! as FaceId;
    const result = deleteFaces(mesh, { faceIds: [faceId] }, ctx);
    for (const id of result.mapping.faces.created) {
      expect(result.mapping.faces.deleted.has(id)).toBe(false);
    }
    expect(result.mapping.faces.replacedBy.has(faceId)).toBe(false);
  });
});
