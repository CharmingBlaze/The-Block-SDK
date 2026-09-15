import { createSequenceIdFactory } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  MeshBuilder,
  createMeshOperationContext,
  duplicateFaces,
  joinMeshes,
  separateFaces,
  trianglesToQuads,
  triangulateFaces,
} from "../src/index";

describe("MESH-OP-025/026 duplicate separate join quads", () => {
  it("duplicates selected faces as a new island", () => {
    const ids = createSequenceIdFactory("dup");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const faceId = [...mesh.faces.keys()][0]!;
    const verts = mesh.vertices.size;
    const result = duplicateFaces(mesh, { faceIds: [faceId] }, createMeshOperationContext(ids));
    expect(result.createdFaceIds).toHaveLength(1);
    expect(mesh.faces.size).toBe(7);
    expect(mesh.vertices.size).toBeGreaterThan(verts);
    expect(result.mapping.faces.created.has(result.createdFaceIds[0]!)).toBe(true);
  });

  it("separates faces without leaving the original", () => {
    const ids = createSequenceIdFactory("sep");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const faceId = [...mesh.faces.keys()][0]!;
    const result = separateFaces(mesh, { faceIds: [faceId] }, createMeshOperationContext(ids));
    expect(mesh.faces.has(faceId)).toBe(false);
    expect(result.createdFaceIds).toHaveLength(1);
    expect(mesh.faces.has(result.createdFaceIds[0]!)).toBe(true);
  });

  it("joins another mesh into the target", () => {
    const ids = createSequenceIdFactory("join");
    const a = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const b = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const result = joinMeshes(a, { source: b }, createMeshOperationContext(ids));
    expect(result.createdFaceIds).toHaveLength(6);
    expect(a.faces.size).toBe(12);
  });

  it("merges coplanar triangle pairs into quads", () => {
    const ids = createSequenceIdFactory("q");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    triangulateFaces(mesh, {}, createMeshOperationContext(ids));
    expect(mesh.faces.size).toBe(12);
    const result = trianglesToQuads(mesh, {}, createMeshOperationContext(ids));
    expect(result.quadFaceIds.length).toBeGreaterThan(0);
    expect([...mesh.faces.values()].some((face) => mesh.getFaceVertices(face.id).length === 4)).toBe(true);
  });
});
