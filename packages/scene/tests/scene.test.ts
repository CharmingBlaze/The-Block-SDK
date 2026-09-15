import { describe, expect, it } from "vitest";
import { CyclicHierarchyError, createSequenceIdFactory } from "@modeling-kit/core";
import { createModelDocument, validateDocument } from "@modeling-kit/document";
import { Vector3 } from "@modeling-kit/math";
import {
  addNode,
  descendants,
  duplicateSubtree,
  getNode,
  groupNodes,
  removeNode,
  reparent,
  setLocalTransform,
  setNodeLocked,
  setNodeVisible,
  ungroupNode,
  worldMatrix,
  effectiveLocked,
  effectiveVisibility,
} from "../src/index";

function setup() {
  const ids = createSequenceIdFactory("s");
  const document = createModelDocument({ ids });
  return { document, ids };
}

describe("scene graph", () => {
  it("adds, removes, and reparents without cycles", () => {
    const { document, ids } = setup();
    const a = addNode(document, ids.object(), { name: "A", type: "empty" });
    const b = addNode(document, ids.object(), { name: "B", type: "empty", parentId: a.id });
    expect(getNode(document, a.id).childIds).toContain(b.id);
    expect(descendants(document, a.id)).toEqual([b.id]);
    expect(() => reparent(document, a.id, b.id)).toThrow(CyclicHierarchyError);
    reparent(document, b.id, document.scene.rootNodeId, { preserveWorld: true });
    expect(getNode(document, b.id).parentId).toBe(document.scene.rootNodeId);
    removeNode(document, a.id);
    expect(document.scene.nodes.has(a.id)).toBe(false);
    expect(validateDocument(document).valid).toBe(true);
  });

  it("preserves world transform when reparenting", () => {
    const { document, ids } = setup();
    const parent = addNode(document, ids.object(), {
      name: "Parent",
      localTransform: {
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    const child = addNode(document, ids.object(), {
      name: "Child",
      parentId: parent.id,
      localTransform: {
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    const before = worldMatrix(document, child.id).transformPoint(new Vector3(0, 0, 0));
    expect(before.equals(new Vector3(12, 0, 0), 1e-6)).toBe(true);
    reparent(document, child.id, document.scene.rootNodeId, { preserveWorld: true });
    const after = worldMatrix(document, child.id).transformPoint(new Vector3(0, 0, 0));
    expect(after.equals(before, 1e-5)).toBe(true);
    expect(getNode(document, child.id).localTransform.position.x).toBeCloseTo(12);
  });

  it("groups, duplicates, and ungroups", () => {
    const { document, ids } = setup();
    const a = addNode(document, ids.object(), { name: "A" });
    const b = addNode(document, ids.object(), { name: "B" });
    const groupId = groupNodes(document, [a.id, b.id], ids.object(), "G");
    expect(getNode(document, a.id).parentId).toBe(groupId);
    const copyId = duplicateSubtree(document, groupId, () => ids.object());
    expect(getNode(document, copyId).childIds).toHaveLength(2);
    ungroupNode(document, groupId);
    expect(document.scene.nodes.has(groupId)).toBe(false);
    expect(getNode(document, a.id).parentId).toBe(document.scene.rootNodeId);
    expect(validateDocument(document).valid).toBe(true);
  });

  it("updates local transforms", () => {
    const { document, ids } = setup();
    const node = addNode(document, ids.object(), { name: "N" });
    setLocalTransform(document, node.id, {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(getNode(document, node.id).localTransform.position.y).toBe(2);
  });

  it("keeps local transform when requested and computes effective visibility", () => {
    const { document, ids } = setup();
    const parent = addNode(document, ids.object(), {
      name: "Parent",
      localTransform: {
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    const child = addNode(document, ids.object(), {
      name: "Child",
      parentId: parent.id,
      localTransform: {
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    reparent(document, child.id, document.scene.rootNodeId, { mode: "keep-local-transform" });
    expect(getNode(document, child.id).localTransform.position.x).toBeCloseTo(2);
    setNodeVisible(document, parent.id, false);
    const hidden = addNode(document, ids.object(), { name: "Hidden", parentId: parent.id });
    expect(effectiveVisibility(document, hidden.id)).toBe(false);
    setNodeLocked(document, parent.id, true);
    expect(effectiveLocked(document, hidden.id)).toBe(true);
    const kept = addNode(document, ids.object(), { name: "Keep" });
    const extra = addNode(document, ids.object(), { name: "Extra", parentId: kept.id });
    removeNode(document, kept.id, { preserveChildren: true });
    expect(document.scene.nodes.has(kept.id)).toBe(false);
    expect(getNode(document, extra.id).parentId).toBe(document.scene.rootNodeId);
  });
});
