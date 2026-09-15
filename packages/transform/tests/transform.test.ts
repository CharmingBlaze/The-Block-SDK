import { createSequenceIdFactory, IllegalLifecycleTransitionError } from "@modeling-kit/core";
import { createModelDocument } from "@modeling-kit/document";
import { addNode, getNode } from "@modeling-kit/scene";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { TransformGesture, selectionRoots } from "../src/index";

describe("@modeling-kit/transform", () => {
  it("translates in parent space and supports negative scale", () => {
    const ids = createSequenceIdFactory("xf");
    const document = createModelDocument({ ids });
    const objectId = ids.object();
    addNode(document, objectId, {
      name: "Box",
      type: "empty",
      localTransform: {
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: -2, z: 1 },
      },
    });
    const gesture = new TransformGesture(
      {
        document,
        meshes: new Map(),
        emit: () => undefined,
      },
      { mode: "translate", space: "parent", objectIds: [objectId] },
    );
    gesture.update({ translation: { x: 0, y: 3, z: 0 } });
    expect(getNode(document, objectId).localTransform.position.y).toBeCloseTo(3);
    expect(getNode(document, objectId).localTransform.scale.y).toBe(-2);
    expect(gesture.hasMeaningfulChange()).toBe(true);
    gesture.restoreBaseline();
    expect(getNode(document, objectId).localTransform.position.y).toBeCloseTo(0);
    expect(getNode(document, objectId).localTransform.scale.y).toBe(-2);
  });

  it("does not double-transform a child when its parent is also selected", () => {
    const ids = createSequenceIdFactory("xf2");
    const document = createModelDocument({ ids });
    const parentId = ids.object();
    const childId = ids.object();
    addNode(document, parentId, {
      name: "Parent",
      type: "group",
      localTransform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    addNode(document, childId, {
      name: "Child",
      type: "empty",
      parentId,
      localTransform: {
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    expect(selectionRoots(document, [parentId, childId])).toEqual([parentId]);
    const gesture = new TransformGesture(
      {
        document,
        meshes: new Map(),
        emit: () => undefined,
      },
      { mode: "translate", space: "world", objectIds: [parentId, childId] },
    );
    gesture.update({ translation: { x: 0, y: 4, z: 0 } });
    expect(getNode(document, parentId).localTransform.position.y).toBeCloseTo(4);
    expect(getNode(document, childId).localTransform.position).toEqual({ x: 2, y: 0, z: 0 });
  });

  it("uses OperationLifecycleMachine: cancel then update is illegal", () => {
    const { gesture } = translateBox();
    expect(gesture.state).toBe("beginning");
    gesture.update({ translation: { x: 1, y: 0, z: 0 } });
    expect(gesture.state).toBe("active");
    gesture.restoreBaseline();
    expect(gesture.state).toBe("cancelled");
    expect(() => gesture.update({ translation: { x: 2, y: 0, z: 0 } })).toThrow(
      IllegalLifecycleTransitionError,
    );
    expect(() => gesture.restoreBaseline()).toThrow(IllegalLifecycleTransitionError);
  });

  it("uses OperationLifecycleMachine: commit then update is illegal", () => {
    const { gesture } = translateBox();
    gesture.update({ translation: { x: 0, y: 1, z: 0 } });
    gesture.commit();
    expect(gesture.state).toBe("completed");
    expect(() => gesture.update({ translation: { x: 0, y: 2, z: 0 } })).toThrow(
      IllegalLifecycleTransitionError,
    );
    gesture.commit();
    expect(gesture.state).toBe("completed");
  });

  it("allows cancel from beginning without an update", () => {
    const { gesture } = translateBox();
    gesture.restoreBaseline();
    expect(gesture.state).toBe("cancelled");
    expect(() => gesture.update({ translation: { x: 1, y: 0, z: 0 } })).toThrow(
      IllegalLifecycleTransitionError,
    );
  });

  it("bumps mesh position revision, not topology, for vertex moves", () => {
    const ids = createSequenceIdFactory("xf-pos");
    const document = createModelDocument({ ids });
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const objectId = ids.object();
    addNode(document, objectId, {
      name: "Mesh",
      type: "mesh_instance",
      payloadRef: mesh.id,
    });
    const topology = mesh.topologyRevision;
    const positions = mesh.positionsRevision;
    const vertexId = [...mesh.vertices.keys()][0]!;
    const gesture = new TransformGesture(
      {
        document,
        meshes: new Map([[mesh.id, mesh]]),
        emit: () => undefined,
      },
      { mode: "translate", space: "world", objectIds: [objectId], meshId: mesh.id, vertexIds: [vertexId] },
    );
    gesture.update({ translation: { x: 0.25, y: 0, z: 0 } });
    expect(mesh.topologyRevision).toBe(topology);
    expect(mesh.positionsRevision).toBeGreaterThan(positions);
    gesture.restoreBaseline();
    expect(mesh.topologyRevision).toBe(topology);
  });

  it("translates in view and normal spaces with numeric rotate/scale and pivots", () => {
    const ids = createSequenceIdFactory("xf-spaces");
    const document = createModelDocument({ ids });
    const objectId = ids.object();
    addNode(document, objectId, {
      name: "Box",
      type: "empty",
      localTransform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    const view = new TransformGesture(
      { document, meshes: new Map(), emit: () => undefined },
      {
        mode: "translate",
        space: "view",
        objectIds: [objectId],
        viewRotation: { x: 0, y: 0.70710678118, z: 0, w: 0.70710678118 },
      },
    );
    view.update({ translation: { x: 2, y: 0, z: 0 } });
    expect(getNode(document, objectId).localTransform.position.z).toBeCloseTo(-2, 4);
    view.restoreBaseline();

    const normal = new TransformGesture(
      { document, meshes: new Map(), emit: () => undefined },
      {
        mode: "translate",
        space: "normal",
        objectIds: [objectId],
        normal: { x: 0, y: 0, z: 1 },
        axis: { x: 0, y: 1, z: 0 },
      },
    );
    normal.update({ translation: { x: 0, y: 3, z: 0 } });
    expect(getNode(document, objectId).localTransform.position.z).toBeCloseTo(3, 4);
    normal.restoreBaseline();

    const rotate = new TransformGesture(
      { document, meshes: new Map(), emit: () => undefined },
      { mode: "rotate", space: "world", objectIds: [objectId], pivot: "cursor", cursor: { x: 0, y: 0, z: 0 } },
    );
    rotate.update({ rotation: { axis: { x: 0, y: 1, z: 0 }, angle: Math.PI / 2 } });
    expect(rotate.hasMeaningfulChange()).toBe(true);
    rotate.commit();

    const other = ids.object();
    addNode(document, other, {
      name: "Other",
      type: "empty",
      localTransform: {
        position: { x: 4, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    const bounds = new TransformGesture(
      { document, meshes: new Map(), emit: () => undefined },
      { mode: "scale", space: "world", objectIds: [objectId, other], pivot: "bounds" },
    );
    bounds.update({ scale: { x: 2, y: 1, z: 1 } });
    expect(bounds.hasMeaningfulChange()).toBe(true);
    bounds.restoreBaseline();

    const leak = new TransformGesture(
      { document, meshes: new Map(), emit: () => undefined },
      { mode: "translate", space: "world", objectIds: [objectId] },
    );
    leak.update({ translation: { x: 1, y: 0, z: 0 } });
    leak.dispose();
    expect(getNode(document, objectId).localTransform.position.x).toBeCloseTo(0);
  });
});

function translateBox() {
  const ids = createSequenceIdFactory("xf-life");
  const document = createModelDocument({ ids });
  const objectId = ids.object();
  addNode(document, objectId, {
    name: "Box",
    type: "empty",
    localTransform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
  });
  const gesture = new TransformGesture(
    {
      document,
      meshes: new Map(),
      emit: () => undefined,
    },
    { mode: "translate", space: "parent", objectIds: [objectId] },
  );
  return { document, objectId, gesture };
}
