import { createSequenceIdFactory } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { getCornerUv, isCornerPinned, projectBox, setCornerPinned, UvUnwrapError } from "@modeling-kit/uv";
import { AutomaticUnwrapCommand, CreatePrimitiveCommand, createModelingSession } from "../src/index";
import type { UvUnwrapBackend } from "@modeling-kit/uv";

describe("AutomaticUnwrapCommand", () => {
  it("undoes and redoes automatic chart unwrap including pins, seams, and UV revision", async () => {
    const session = createModelingSession(createSequenceIdFactory("unwrap-hist"));
    const created = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const mesh = session.meshes.get(created.meshId)!;
    projectBox(mesh, {});
    const pinned = mesh.getFaceCorners([...mesh.faces.keys()][0]!)[0]!;
    setCornerPinned(mesh, pinned, true);
    const before = [...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id));
    const uvRevision = mesh.uvRevision;
    const seamRevision = mesh.seamRevision;
    await session.automaticUnwrap({ meshId: created.meshId, uvChannel: "uv0", options: { ignorePins: true } });
    const after = [...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id));
    expect(after).not.toEqual(before);
    expect(isCornerPinned(mesh, pinned)).toBe(true);
    expect(mesh.uvRevision).toBeGreaterThan(uvRevision);
    expect(mesh.seamRevision).toBeGreaterThan(seamRevision);
    session.undo();
    expect([...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id))).toEqual(before);
    expect(isCornerPinned(mesh, pinned)).toBe(true);
    session.redo();
    expect([...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id))).toEqual(after);
    expect(isCornerPinned(mesh, pinned)).toBe(true);
  });

  it("does not execute a command when prepare fails", async () => {
    const session = createModelingSession(createSequenceIdFactory("unwrap-fail"));
    const created = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const mesh = session.meshes.get(created.meshId)!;
    projectBox(mesh, {});
    const before = [...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id));
    const backend: UvUnwrapBackend = {
      initialize: () => Promise.resolve(),
      unwrap: () => Promise.reject(new UvUnwrapError("invalid-atlas", "prepare failed")),
      dispose: () => undefined,
    };
    await expect(
      AutomaticUnwrapCommand.prepare(mesh, { meshId: created.meshId, uvChannel: "uv0" }, { backend }),
    ).rejects.toMatchObject({ code: "invalid-atlas" });
    expect([...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id))).toEqual(before);
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.canUndo).toBe(false);
  });
});
