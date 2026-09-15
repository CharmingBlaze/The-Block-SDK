import { describe, expect, it } from "vitest";
import { CyclicHierarchyError, HierarchyError, createSequenceIdFactory } from "@modeling-kit/core";
import {
  addNode,
  createModelDocument,
  duplicateHierarchy,
  findUnusedResources,
  getEffectiveVisibility,
  getEffectiveLocked,
  getEffectiveSelectable,
  getMeshUsers,
  getNode,
  getRoots,
  groupNodes,
  parseDocument,
  removeNode,
  reorderNode,
  reparent,
  serializeDocument,
  setLocalTransform,
  setNodeVisible,
  setNodeLocked,
  ungroupNode,
  validateDocument,
  worldMatrix,
  worldTransformCache,
} from "../src/index";
import { Vector3 } from "@modeling-kit/math";

function setup() {
  const ids = createSequenceIdFactory("sg");
  const document = createModelDocument({ ids });
  return { document, ids };
}

describe("scene graph hierarchy", () => {
  it("adds roots and children with stable ids and explicit order", () => {
    const { document, ids } = setup();
    const a = addNode(document, ids.object(), { name: "A", type: "group" });
    const b = addNode(document, ids.object(), { name: "B", type: "group" });
    const child = addNode(document, ids.object(), { name: "Child", type: "empty", parentId: a.id });
    expect(getRoots(document)).toEqual([a.id, b.id]);
    expect(getNode(document, a.id).childIds).toEqual([child.id]);
    expect(document.scene.nodes.has(a.id)).toBe(true);
  });

  it("removes recursively and while preserving children", () => {
    const { document, ids } = setup();
    const parent = addNode(document, ids.object(), { name: "P" });
    const child = addNode(document, ids.object(), { name: "C", parentId: parent.id });
    const extra = addNode(document, ids.object(), { name: "E", parentId: child.id });
    removeNode(document, child.id, { policy: "preserve-children" });
    expect(document.scene.nodes.has(child.id)).toBe(false);
    expect(getNode(document, extra.id).parentId).toBe(parent.id);
    removeNode(document, parent.id, { policy: "recursive" });
    expect(document.scene.nodes.has(extra.id)).toBe(false);
  });

  it("rejects self-parenting, descendant cycles, and duplicate children", () => {
    const { document, ids } = setup();
    const a = addNode(document, ids.object(), { name: "A" });
    const b = addNode(document, ids.object(), { name: "B", parentId: a.id });
    expect(() => reparent(document, a.id, b.id)).toThrow(CyclicHierarchyError);
    expect(() => reparent(document, a.id, a.id)).toThrow(CyclicHierarchyError);
    expect(() => addNode(document, a.id, { name: "Dup" })).toThrow(HierarchyError);
  });

  it("groups, ungroups, and reorders without changing transforms of siblings", () => {
    const { document, ids } = setup();
    const a = addNode(document, ids.object(), { name: "A" });
    const b = addNode(document, ids.object(), { name: "B" });
    const groupId = groupNodes(document, [a.id, b.id], ids.object(), "G");
    expect(getNode(document, a.id).parentId).toBe(groupId);
    reorderNode(document, b.id, 0);
    expect(getNode(document, groupId).childIds[0]).toBe(b.id);
    ungroupNode(document, groupId);
    expect(getRoots(document)).toContain(a.id);
  });

  it("hides a parent and reports effective child visibility", () => {
    const { document, ids } = setup();
    const parent = addNode(document, ids.object(), { name: "P" });
    const child = addNode(document, ids.object(), { name: "C", parentId: parent.id });
    setNodeVisible(document, parent.id, false);
    expect(getEffectiveVisibility(document, child.id)).toBe(false);
  });

  it("locks a parent and reports effective child lock", () => {
    const { document, ids } = setup();
    const parent = addNode(document, ids.object(), { name: "P" });
    const child = addNode(document, ids.object(), { name: "C", parentId: parent.id });
    setNodeLocked(document, parent.id, true);
    expect(getEffectiveLocked(document, child.id)).toBe(true);
    expect(getEffectiveSelectable(document, child.id)).toBe(false);
  });

  it("keeps shared meshes after deleting one instance", () => {
    const { document, ids } = setup();
    const meshId = ids.mesh();
    document.meshes.set({
      id: meshId,
      name: "Cube",
      materialIds: [],
      metadata: {},
    });
    const a = addNode(document, ids.object(), {
      name: "A",
      type: "mesh_instance",
      payloadRef: meshId,
      meshId,
    });
    const b = addNode(document, ids.object(), {
      name: "B",
      type: "mesh_instance",
      payloadRef: meshId,
      meshId,
    });
    expect(getMeshUsers(document, meshId).size).toBe(2);
    removeNode(document, a.id);
    expect(document.meshes.has(meshId)).toBe(true);
    expect(getMeshUsers(document, meshId).has(b.id)).toBe(true);
    expect(findUnusedResources(document).meshIds).not.toContain(meshId);
  });

  it("duplicates as a linked instance or independent copy", () => {
    const { document, ids } = setup();
    const meshId = ids.mesh();
    document.meshes.set({ id: meshId, name: "Cube", materialIds: [], metadata: {} });
    const source = addNode(document, ids.object(), {
      name: "Source",
      type: "mesh_instance",
      payloadRef: meshId,
      meshId,
    });
    const linked = duplicateHierarchy(document, source.id, () => ids.object(), { mesh: "link" });
    expect(getNode(document, linked.rootId).payloadRef).toBe(meshId);
    const independent = duplicateHierarchy(document, source.id, () => ids.object(), {
      mesh: "independent",
      nextMeshId: () => ids.mesh(),
    });
    const copyId = getNode(document, independent.rootId).payloadRef;
    expect(copyId).not.toBe(meshId);
    expect(document.meshes.has(copyId as typeof meshId)).toBe(true);
    expect(getMeshUsers(document, meshId).size).toBe(2);
  });

  it("reports unused meshes after the last user is removed", () => {
    const { document, ids } = setup();
    const meshId = ids.mesh();
    document.meshes.set({ id: meshId, name: "Orphan", materialIds: [], metadata: {} });
    const node = addNode(document, ids.object(), {
      name: "Only",
      type: "mesh_instance",
      payloadRef: meshId,
      meshId,
    });
    expect(findUnusedResources(document).meshIds).not.toContain(meshId);
    removeNode(document, node.id);
    expect(findUnusedResources(document).meshIds).toContain(meshId);
  });

  it("round-trips hierarchy order through serialization", () => {
    const { document, ids } = setup();
    addNode(document, ids.object(), { name: "A" });
    addNode(document, ids.object(), { name: "B" });
    const loaded = parseDocument(serializeDocument(document));
    expect(loaded.scene.rootIds.map((id) => getNode(loaded, id).name)).toEqual(["A", "B"]);
    expect(validateDocument(loaded).valid).toBe(true);
  });
});

describe("scene graph transforms", () => {
  it("computes nested world transforms and preserve-world reparent", () => {
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
    reparent(document, child.id, document.scene.rootNodeId, { policy: "preserve-world" });
    const after = worldMatrix(document, child.id).transformPoint(new Vector3(0, 0, 0));
    expect(after.equals(before, 1e-5)).toBe(true);
  });

  it("invalidates only affected descendants", () => {
    const { document, ids } = setup();
    const left = addNode(document, ids.object(), { name: "L" });
    const right = addNode(document, ids.object(), { name: "R" });
    worldMatrix(document, left.id);
    worldMatrix(document, right.id);
    const cache = worldTransformCache(document);
    expect(cache.has(left.id)).toBe(true);
    expect(cache.has(right.id)).toBe(true);
    setLocalTransform(document, left.id, {
      position: { x: 3, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(cache.has(left.id)).toBe(false);
    expect(cache.has(right.id)).toBe(true);
  });

  it("canonicalizes reference_image node type on insert", () => {
    const { document, ids } = setup();
    const node = addNode(document, ids.object(), { name: "Ref", type: "reference_image" });
    expect(node.type).toBe("reference-image");
  });
});
