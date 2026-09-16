import { createSequenceIdFactory } from "@modeling-kit/core";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import { CreateLibraryPrimitiveCommand, CreatePrimitiveCommand, createModelingSession } from "../src/index";

describe("library primitive commands", () => {
  it("undoes and redoes rounded-cube creation without leftover meshes", () => {
    const session = createModelingSession(createSequenceIdFactory("lib-prim"));
    const created = session.execute(
      new CreatePrimitiveCommand("roundedCube", { width: 1, height: 1, depth: 1, radius: 0.2, roundSegments: 3 }),
    );
    expect(session.meshes.has(created.meshId)).toBe(true);
    expect(validateMesh(session.meshes.get(created.meshId)!).statistics.isClosed).toBe(true);

    session.undo();
    expect(session.meshes.has(created.meshId)).toBe(false);
    expect(session.document.scene.nodes.has(created.objectId)).toBe(false);

    session.redo();
    expect(session.meshes.has(created.meshId)).toBe(true);
    expect(session.document.scene.nodes.has(created.objectId)).toBe(true);
    expect(session.meshes.get(created.meshId)!.faces.size).toBeGreaterThan(0);
  });

  it("undoes library sphere without changing catalog cube topology", () => {
    const session = createModelingSession(createSequenceIdFactory("lib-sphere"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    expect(session.meshes.get(cube.meshId)!.vertices.size).toBe(8);
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(6);

    const sphere = session.execute(
      new CreateLibraryPrimitiveCommand("sphere", { radius: 0.5, widthSegments: 10, heightSegments: 6 }),
    );
    expect(validateMesh(session.meshes.get(sphere.meshId)!).statistics.isClosed).toBe(true);

    session.undo();
    expect(session.meshes.has(sphere.meshId)).toBe(false);
    expect(session.meshes.get(cube.meshId)!.vertices.size).toBe(8);

    session.redo();
    expect(session.meshes.has(sphere.meshId)).toBe(true);
    expect(validateMesh(session.meshes.get(sphere.meshId)!).statistics.isClosed).toBe(true);
  });
});
