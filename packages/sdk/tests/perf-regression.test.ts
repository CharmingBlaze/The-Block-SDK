import { describe, expect, it } from "vitest";
import { MeshBuilder, triangulateMesh } from "@modeling-kit/mesh";
import { subdivideFaces } from "@modeling-kit/tools";
import { createModelDocument, serializeDocument, parseDocument } from "@modeling-kit/document";
import { Emitter, createSequenceIdFactory, type EditorEvents } from "@modeling-kit/core";
import { CommandManager, type CommandContext } from "@modeling-kit/history";
import { SelectionManager } from "@modeling-kit/selection";

describe("Performance-related correctness (no wall-clock gates)", () => {
  it("triangulates a subdivided cube without non-finite data", () => {
    const ids = createSequenceIdFactory("bench");
    const mesh = MeshBuilder.createCube(2, 2, 2);
    subdivideFaces(mesh, [...mesh.faces.keys()], ids);
    expect(mesh.faces.size).toBe(24);
    const tri = triangulateMesh(mesh);
    expect(tri.indices.length).toBe(24 * 2 * 3);
    expect(tri.positions.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("round-trips an empty document without changing its id", () => {
    const doc = createModelDocument({ name: "BenchmarkDoc" });
    const reloaded = parseDocument(serializeDocument(doc));
    expect(reloaded.id).toBe(doc.id);
  });

  it("memory regression: history undo/redo commands respect limits without leaking", () => {
    const manager = new CommandManager();
    manager.maxHistoryDepth = 20;
    let counter = 0;
    const context: CommandContext = {
      document: createModelDocument(),
      ids: createSequenceIdFactory("h"),
      selection: new SelectionManager(),
      meshes: new Map(),
      textures: new Map(),
      events: new Emitter<EditorEvents>(),
      syncMesh: () => undefined,
    };

    for (let i = 0; i < 100; i++) {
      manager.execute(
        {
          id: `cmd-${i}`,
          label: `Add ${i}`,
          execute() {
            counter++;
          },
          undo() {
            counter--;
          },
        },
        context,
      );
    }

    expect(counter).toBe(100);
    expect(manager.undoStack.length).toBe(20);
    expect(manager.canUndo).toBe(true);

    for (let i = 0; i < 20; i++) {
      manager.undo(context);
    }
    expect(counter).toBe(80);
    expect(manager.canUndo).toBe(false);
  });
});
