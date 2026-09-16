import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  CreatePrimitiveCommand,
  GroupObjectsCommand,
  SetLockedCommand,
  SetTransformsCommand,
  SetVisibilityCommand,
  createModelingSession,
} from "@modeling-kit/commands";
import { setNodeSelectable } from "@modeling-kit/document";
import { describe, expect, it } from "vitest";
import { centerRequest, mountAdapter } from "./gpu-picking-helpers";

describe("GPU ID-buffer object picking", () => {
  it("picks a single cube and prefers the front overlapping cube", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-obj"));
    const front = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const back = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: back.objectId,
            before: session.document.scene.nodes.get(back.objectId)!.localTransform,
            after: {
              position: { x: 0, y: 0, z: -3 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    const adapter = mountAdapter(session);
    const hit = await adapter.pickPoint(centerRequest("object"));
    expect(hit?.source).toBe("gpu-id-buffer");
    expect(hit?.objectId).toBe(front.objectId);
    expect(adapter.lastPickSource).toBe("gpu-id-buffer");
    adapter.dispose();
  });

  it("ignores hidden and locked objects and non-selectable flags", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-flags"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    session.execute(new SetVisibilityCommand({ objectId: cube.objectId, visible: false }));
    expect(await adapter.pickPoint(centerRequest("object"))).toBeUndefined();
    session.execute(new SetVisibilityCommand({ objectId: cube.objectId, visible: true }));
    session.execute(new SetLockedCommand({ objectId: cube.objectId, locked: true }));
    expect(await adapter.pickPoint(centerRequest("object"))).toBeUndefined();
    session.execute(new SetLockedCommand({ objectId: cube.objectId, locked: false }));
    setNodeSelectable(session.document, cube.objectId, false);
    expect(await adapter.pickPoint(centerRequest("object"))).toBeUndefined();
    setNodeSelectable(session.document, cube.objectId, true);
    expect((await adapter.pickPoint(centerRequest("object")))?.objectId).toBe(cube.objectId);
    adapter.dispose();
  });

  it("picks transformed, parent-transformed, and negatively scaled cubes", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-xf"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: cube.objectId,
            before: session.document.scene.nodes.get(cube.objectId)!.localTransform,
            after: {
              position: { x: 4, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    expect(await adapter.pickPoint(centerRequest("object"))).toBeUndefined();
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: cube.objectId,
            before: session.document.scene.nodes.get(cube.objectId)!.localTransform,
            after: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: -1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    expect((await adapter.pickPoint(centerRequest("object")))?.objectId).toBe(cube.objectId);

    session.selection.replace({ domain: "object", objectIds: [cube.objectId] });
    const group = session.execute(new GroupObjectsCommand({ name: "Parent" }));
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: group.groupId,
            before: session.document.scene.nodes.get(group.groupId)!.localTransform,
            after: {
              position: { x: 0, y: 3, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    expect(await adapter.pickPoint(centerRequest("object"))).toBeUndefined();
    adapter.dispose();
  });
});
