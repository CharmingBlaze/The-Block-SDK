import { describe, expect, it } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  addNode,
  createModelDocument,
  extractFragment,
  getNode,
  insertFragment,
} from "../src/index";

describe("document fragments", () => {
  it("remaps ids while preserving hierarchy and shared mesh references", () => {
    const ids = createSequenceIdFactory("frag");
    const document = createModelDocument({ ids });
    const meshId = ids.mesh();
    document.meshes.set({ id: meshId, name: "Cube", materialIds: [], metadata: {} });
    const group = addNode(document, ids.object(), { name: "Group", type: "group" });
    const meshNode = addNode(document, ids.object(), {
      name: "Cube",
      type: "mesh_instance",
      parentId: group.id,
      payloadRef: meshId,
      meshId,
    });
    const fragment = extractFragment(document, [group.id]);
    expect(fragment.nodes.some((node) => node.id === meshNode.id)).toBe(true);
    const inserted = insertFragment(document, fragment, document.scene.rootNodeId, ids, {
      shareResources: true,
    });
    expect(inserted.rootNodeIds).toHaveLength(1);
    expect(inserted.rootNodeIds[0]).not.toBe(group.id);
    const copy = getNode(document, inserted.rootNodeIds[0]!);
    expect(copy.childIds).toHaveLength(1);
    expect(getNode(document, copy.childIds[0]!).payloadRef).toBe(meshId);
    expect(document.meshes.size).toBe(1);
  });
});
