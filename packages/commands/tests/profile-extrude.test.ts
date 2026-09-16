import { createSequenceIdFactory } from "@modeling-kit/core";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import { ExtrudeProfileCommand, createEditor, createModelingSession } from "../src/index";

const square: Array<readonly [number, number]> = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
];

describe("profile extrude command", () => {
  it("undoes and redoes a floor without leftover meshes", () => {
    const session = createModelingSession(createSequenceIdFactory("profile-floor"));
    const created = session.execute(
      new ExtrudeProfileCommand({
        profile: { kind: "polygon", outer: square },
        depth: 0.3,
        name: "Floor",
      }),
    );
    expect(session.meshes.has(created.meshId)).toBe(true);
    expect(validateMesh(session.meshes.get(created.meshId)!).statistics.isClosed).toBe(true);

    session.undo();
    expect(session.meshes.has(created.meshId)).toBe(false);
    expect(session.document.scene.nodes.has(created.objectId)).toBe(false);

    session.redo();
    expect(session.meshes.has(created.meshId)).toBe(true);
    expect(session.document.scene.nodes.has(created.objectId)).toBe(true);
  });

  it("does not mutate the document when the profile is invalid", () => {
    const session = createModelingSession(createSequenceIdFactory("profile-invalid"));
    const nodesBefore = session.document.scene.nodes.size;
    expect(() =>
      session.execute(
        new ExtrudeProfileCommand({
          profile: {
            kind: "polygon",
            outer: [
              [0, 0],
              [1, 1],
              [1, 0],
              [0, 1],
            ],
          },
          depth: 1,
        }),
      ),
    ).toThrow(/cannot be extruded/);
    expect(session.document.scene.nodes.size).toBe(nodesBefore);
    expect(session.meshes.size).toBe(0);
  });

  it("leaves face extrusion on the existing mesh command", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 1 });
    const meshId = cube.meshId;
    const before = editor.session.meshes.get(meshId)!.faces.size;
    cube.select("top").extrude(0.2);
    expect(editor.session.meshes.get(meshId)!.faces.size).toBeGreaterThan(before);
    editor.dispose();
  });

  it("spawns a floor through the fluent editor", () => {
    const editor = createEditor();
    const floor = editor.spawn.floor({ outer: square, thickness: 0.15 });
    expect(validateMesh(editor.session.meshes.get(floor.meshId)!).statistics.isClosed).toBe(true);
    editor.undo();
    expect(editor.session.meshes.has(floor.meshId)).toBe(false);
    editor.dispose();
  });

  it("spawns a path wall and restores selection on undo", () => {
    const editor = createEditor();
    const wall = editor.spawn.wallPath({
      outer: [
        [0, 0],
        [2, 0],
        [2, 2],
      ],
      height: 2,
      thickness: 0.2,
      name: "Wall",
    });
    expect(editor.session.document.meshes.get(wall.meshId)?.name).toBe("Wall");
    editor.undo();
    expect(editor.session.meshes.has(wall.meshId)).toBe(false);
    editor.dispose();
  });
});
