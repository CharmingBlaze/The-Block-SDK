import { describe, expect, it } from "vitest";
import * as ModelingKit from "../src/index";

describe("scene ownership vertical slice", () => {
  it("parents a cube under a group, preserves world on reparent, undoes, and reloads", () => {
    const session = ModelingKit.createModelingSession();
    const group = ModelingKit.addNode(session.document, session.ids.object(), {
      name: "Group",
      type: "group",
    });
    const cube = session.execute(
      new ModelingKit.CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    session.execute(
      new ModelingKit.ReparentCommand({
        objectId: cube.objectId,
        newParentId: group.id,
        preserveWorld: true,
      }),
    );
    ModelingKit.setLocalTransform(session.document, group.id, {
      position: { x: 4, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
    const worldUnderGroup = ModelingKit.worldMatrix(session.document, cube.objectId);
    expect(worldUnderGroup.elements[12]).toBeCloseTo(4);

    session.execute(
      new ModelingKit.ReparentCommand({
        objectId: cube.objectId,
        newParentId: session.document.scene.rootNodeId,
        preserveWorld: true,
      }),
    );
    expect(ModelingKit.getNode(session.document, cube.objectId).localTransform.position.x).toBeCloseTo(4);
    session.undo();
    expect(ModelingKit.getNode(session.document, cube.objectId).parentId).toBe(group.id);
    session.redo();
    expect(ModelingKit.getNode(session.document, cube.objectId).parentId).toBe(
      session.document.scene.rootNodeId,
    );

    const json = session.saveNativeJson();
    const reloaded = ModelingKit.ModelingSession.loadNativeJson(json);
    expect(ModelingKit.getNode(reloaded.document, cube.objectId).payloadRef).toBe(cube.meshId);
    expect(reloaded.document.settings.upAxis).toBe("Y");
    expect(reloaded.document.settings.handedness).toBe("right");
  });
});
