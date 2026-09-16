import { createSequenceIdFactory } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  BevelEdgesCommand,
  CatmullClarkSubdivideCommand,
  CreatePrimitiveCommand,
  SetEdgeCreasesCommand,
  createModelingSession,
} from "../src/index";
import { meshFingerprint } from "@modeling-kit/mesh";

describe("crease and bevel commands", () => {
  it("undoes and redoes crease assignment plus Catmull-Clark", () => {
    const session = createModelingSession(createSequenceIdFactory("cmd-crease"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const mesh = session.meshes.get(cube.meshId)!;
    const edgeIds = [...mesh.edges.keys()];
    session.selection.replace({ domain: "edge", objectId: cube.objectId, elementIds: edgeIds });
    const beforeCrease = meshFingerprint(mesh);
    session.execute(new SetEdgeCreasesCommand({ weight: 0.7 }));
    expect([...mesh.edges.values()].every((edge) => edge.creaseWeight === 0.7)).toBe(true);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeCrease);
    session.redo();
    expect([...mesh.edges.values()].every((edge) => edge.creaseWeight === 0.7)).toBe(true);

    const beforeCc = meshFingerprint(mesh);
    session.execute(new CatmullClarkSubdivideCommand({ iterations: 1 }));
    expect(mesh.faces.size).toBe(24);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeCc);
    session.redo();
    expect(mesh.faces.size).toBe(24);
  });

  it("undoes a clip-miter bevel", () => {
    const session = createModelingSession(createSequenceIdFactory("cmd-bevel"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const mesh = session.meshes.get(cube.meshId)!;
    const vertexId = [...mesh.vertices.keys()][0]!;
    const edgeIds = mesh.getVertexEdges(vertexId).slice(0, 2);
    session.selection.replace({ domain: "edge", objectId: cube.objectId, elementIds: edgeIds });
    const before = meshFingerprint(mesh);
    session.execute(new BevelEdgesCommand({ offset: 0.2, miterMode: "clip" }));
    expect(mesh.faces.size).toBeGreaterThan(6);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
    session.redo();
    expect(mesh.faces.size).toBeGreaterThan(6);
  });

  it("rejects invalid crease weights through the command", () => {
    const session = createModelingSession(createSequenceIdFactory("cmd-bad-crease"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const mesh = session.meshes.get(cube.meshId)!;
    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [[...mesh.edges.keys()][0]!],
    });
    const before = meshFingerprint(mesh);
    expect(() => session.execute(new SetEdgeCreasesCommand({ weight: 2 }))).toThrow(/invalid-crease-weight/);
    expect(meshFingerprint(mesh)).toBe(before);
  });
});
