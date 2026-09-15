import { describe, expect, it } from "vitest";
import { MeshBuilder, triangulateMesh } from "@modeling-kit/mesh";
import { subdivideFaces } from "@modeling-kit/tools";
import { generateGrid } from "@modeling-kit/primitives";
import { createModelDocument, serializeDocument, parseDocument } from "@modeling-kit/document";
import { addNode } from "@modeling-kit/scene";
import { identityTransform } from "@modeling-kit/math";
import { Emitter, createSequenceIdFactory, type EditorEvents } from "@modeling-kit/core";
import { CommandManager, type CommandContext } from "@modeling-kit/history";
import { SelectionManager } from "@modeling-kit/selection";

describe("Performance Benchmarks and Memory Regression", () => {
  it("benchmarks mesh triangulation on subdivided models", () => {
    const ids = createSequenceIdFactory("bench");
    const mesh = MeshBuilder.createCube(2, 2, 2);
    subdivideFaces(mesh, [...mesh.faces.keys()], ids);
    expect(mesh.faces.size).toBe(24);

    const t0 = performance.now();
    const tri = triangulateMesh(mesh);
    const durationMs = performance.now() - t0;

    expect(tri.indices.length).toBe(24 * 2 * 3);
    expect(durationMs).toBeLessThan(100);
  });

  it("benchmarks document serialization and deserialization", () => {
    const doc = createModelDocument({ name: "BenchmarkDoc" });

    const t0 = performance.now();
    const serialized = serializeDocument(doc);
    const reloaded = parseDocument(serialized);
    const durationMs = performance.now() - t0;

    expect(reloaded.id).toBe(doc.id);
    expect(durationMs).toBeLessThan(100);
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

  it("records triangulation latency for ~10k vertices", () => {
    const mesh = generateGrid({ width: 1, depth: 1, segmentsX: 100, segmentsZ: 100 }).mesh;
    expect(mesh.vertices.size).toBe(101 * 101);
    const t0 = performance.now();
    const tri = triangulateMesh(mesh);
    const durationMs = performance.now() - t0;
    expect(tri.indices.length).toBe(100 * 100 * 2 * 3);
    expect(durationMs).toBeLessThan(2000);
  });

  it("records triangulation latency for ~100k vertices", () => {
    const mesh = generateGrid({ width: 1, depth: 1, segmentsX: 316, segmentsZ: 316 }).mesh;
    expect(mesh.vertices.size).toBeGreaterThanOrEqual(100_000);
    const t0 = performance.now();
    const tri = triangulateMesh(mesh);
    const durationMs = performance.now() - t0;
    expect(tri.indices.length).toBe(316 * 316 * 2 * 3);
    expect(durationMs).toBeLessThan(15_000);
  }, 30_000);

  it("serializes 1k scene nodes without unbounded growth", () => {
    const ids = createSequenceIdFactory("nodes");
    const doc = createModelDocument({ ids, name: "ManyNodes" });
    for (let i = 0; i < 1000; i += 1) {
      addNode(doc, ids.object(), {
        name: `n${i}`,
        type: "group",
        localTransform: identityTransform(),
      });
    }
    expect(doc.scene.nodes.size).toBeGreaterThan(1000);
    const t0 = performance.now();
    const serialized = serializeDocument(doc);
    const reloaded = parseDocument(serialized);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(reloaded.scene.nodes.size).toBe(doc.scene.nodes.size);
  });
});
