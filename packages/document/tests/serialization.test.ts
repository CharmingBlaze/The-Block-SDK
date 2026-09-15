import { describe, expect, it } from "vitest";
import { SchemaError, UnsupportedSchemaVersionError, createSequenceIdFactory } from "@modeling-kit/core";
import {
  addNode,
  applyMigrations,
  createModelDocument,
  parseDocument,
  serializeDocument,
  setLocalTransform,
} from "../src/index";

describe("serialization", () => {
  it("preserves ids, hierarchy order, transforms, and unknown metadata", () => {
    const ids = createSequenceIdFactory("ser");
    const document = createModelDocument({ ids, metadata: { plugin: { extra: true } } });
    const node = addNode(document, ids.object(), { name: "Hero", type: "group" });
    setLocalTransform(document, node.id, {
      position: { x: 4, y: 5, z: 6 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 2, z: 1 },
    });
    const current = document.scene.nodes.require(node.id);
    document.scene.nodes.set(node.id, {
      ...current,
      metadata: { ...current.metadata, vendor: { keep: 1 } },
    });
    const loaded = parseDocument(serializeDocument(document));
    expect(loaded.scene.nodes.get(node.id)?.id).toBe(node.id);
    expect(loaded.scene.rootIds).toEqual([node.id]);
    expect(loaded.scene.nodes.get(node.id)?.localTransform.position.x).toBe(4);
    expect(loaded.metadata.plugin).toEqual({ extra: true });
    expect(loaded.scene.nodes.get(node.id)?.metadata.vendor).toEqual({ keep: 1 });
  });

  it("migrates schema 1 documents and rejects cycles", () => {
    const migrated = applyMigrations(
      {
        schemaVersion: 1,
        id: "doc",
        name: "Old",
        settings: { units: "meter", unitsPerMeter: 1, gridSize: 1 },
        scene: {
          rootNodeId: "root",
          nodes: [
            {
              id: "root",
              name: "Scene",
              type: "group",
              parentId: null,
              childIds: ["a"],
              visible: true,
              locked: false,
              selectable: true,
              localTransform: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
              tags: [],
              metadata: {},
            },
            {
              id: "a",
              name: "A",
              type: "empty",
              parentId: "root",
              childIds: [],
              visible: true,
              locked: false,
              selectable: true,
              localTransform: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
              tags: [],
              metadata: {},
            },
          ],
        },
        meshes: { revision: 0, items: [] },
        materials: { revision: 0, items: [] },
        textures: { revision: 0, items: [] },
        skeletons: { revision: 0, items: [] },
        animations: { revision: 0, items: [] },
        metadata: {},
      },
      1,
    );
    expect(migrated.schemaVersion).toBe(2);
    expect((migrated.scene as { rootIds: string[] }).rootIds).toEqual(["a"]);

    const cyclic = createModelDocument({ ids: createSequenceIdFactory("cyc") });
    const payload = JSON.parse(serializeDocument(cyclic)) as {
      scene: {
        rootIds: string[];
        nodes: Array<{ id: string; childIds: string[]; parentId: string | null }>;
      };
    };
    const root = payload.scene.nodes.find((node) => node.parentId === null)!;
    payload.scene.nodes.push({
      id: "loop-a",
      childIds: ["loop-b"],
      parentId: root.id,
      ...minimalNode("loop-a"),
    });
    payload.scene.nodes.push({
      id: "loop-b",
      childIds: ["loop-a"],
      parentId: "loop-a",
      ...minimalNode("loop-b"),
    });
    root.childIds.push("loop-a");
    payload.scene.rootIds.push("loop-a");
    expect(() => parseDocument(JSON.stringify(payload))).toThrow(SchemaError);
  });

  it("rejects newer schema versions and is canonical-key stable", () => {
    const ids = createSequenceIdFactory("canon");
    const document = createModelDocument({ ids });
    addNode(document, ids.object(), { name: "A" });
    const first = serializeDocument(document);
    const second = serializeDocument(parseDocument(first));
    expect(second).toBe(first);
    expect(() =>
      parseDocument(
        JSON.stringify({
          schemaVersion: 99,
          id: "x",
          name: "TooNew",
          settings: { units: "meter", unitsPerMeter: 1, gridSize: 1 },
          scene: { rootNodeId: "root", rootIds: [], nodes: [] },
        }),
      ),
    ).toThrow(UnsupportedSchemaVersionError);
  });
});

function minimalNode(id: string) {
  return {
    name: id,
    type: "empty" as const,
    visible: true,
    locked: false,
    selectable: true,
    localTransform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    tags: [],
    metadata: {},
  };
}
