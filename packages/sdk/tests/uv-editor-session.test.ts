import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession, ProjectUvsCommand } from "@modeling-kit/commands";
import { getCornerUv } from "@modeling-kit/uv";
import { describe, expect, it } from "vitest";
import { uv } from "../src/uv";

describe("session UV editor", () => {
  it("records one history entry per transform and undoes exact UVs", () => {
    const session = createModelingSession(createSequenceIdFactory("uv-hist"));
    const created = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    session.selection.replace({ domain: "object", objectId: created.objectId });
    session.execute(new ProjectUvsCommand({ projection: "box" }));
    const mesh = session.meshes.get(created.meshId)!;
    const editor = uv.createEditor({
      session,
      meshId: created.meshId,
      textureResolution: { width: 128, height: 128 },
    });
    const vertex = [...editor.topology().vertices.values()][0]!;
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    const before = getCornerUv(mesh, vertex.cornerIds[0]!);
    const historyBefore = session.history.undoStack.length;

    editor.transform.begin({ operation: "move", pivot: "selection-center" });
    editor.transform.update({ translate: [0.2, 0.05] });
    editor.transform.update({ translate: [0.4, 0.1] });
    editor.transform.commit();

    expect(session.history.undoStack.length).toBe(historyBefore + 1);
    const moved = getCornerUv(mesh, vertex.cornerIds[0]!);
    expect(moved[0] - before[0]).toBeCloseTo(0.4);

    session.undo();
    expect(getCornerUv(mesh, vertex.cornerIds[0]!)).toEqual(before);
    session.redo();
    expect(getCornerUv(mesh, vertex.cornerIds[0]!)[0]).toBeCloseTo(moved[0]);
    editor.dispose();
  });

  it("synchronizes 3D and UV face selection without looping", () => {
    const session = createModelingSession(createSequenceIdFactory("uv-sync"));
    const created = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    session.selection.replace({ domain: "object", objectId: created.objectId });
    session.execute(new ProjectUvsCommand({ projection: "box" }));
    let faceCallbacks = 0;
    session.selection.onChange(() => {
      faceCallbacks += 1;
    });
    const editor = uv.createEditor({
      session,
      meshId: created.meshId,
      objectId: created.objectId,
      syncSelection: true,
    });
    const face = [...editor.topology().faces.values()][0]!;
    const before = faceCallbacks;
    editor.select({ mode: "face", operation: "replace", ids: [face.id] });
    expect(session.selection.domain).toBe("face");
    expect(session.selection.elementIds).toContain(face.faceId);
    const afterUv = faceCallbacks;
    session.selection.replace({
      domain: "face",
      objectId: created.objectId,
      elementIds: [created.faceIds.posY],
    });
    expect(editor.selection.selectedFaceIds(editor.topology())).toContain(created.faceIds.posY);
    expect(faceCallbacks).toBeGreaterThan(afterUv);
    expect(faceCallbacks - before).toBeLessThan(8);
    editor.dispose();
  });

  it("does not record history for a cancelled or zero-delta UV transform", () => {
    const session = createModelingSession(createSequenceIdFactory("uv-noop"));
    const created = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    session.selection.replace({ domain: "object", objectId: created.objectId });
    session.execute(new ProjectUvsCommand({ projection: "box" }));
    const editor = uv.createEditor({ session, meshId: created.meshId });
    const vertex = [...editor.topology().vertices.values()][0]!;
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    const historyBefore = session.history.undoStack.length;
    editor.transform.begin({ operation: "move" });
    editor.transform.update({ translate: [0.25, 0] });
    editor.transform.cancel();
    expect(session.history.undoStack.length).toBe(historyBefore);
    editor.transform.begin({ operation: "move" });
    editor.transform.commit();
    expect(session.history.undoStack.length).toBe(historyBefore);
    editor.dispose();
    expect(session.events.listenerCount("mesh:changed")).toBe(0);
  });
});
