import { describe, expect, it } from "vitest";
import { createInputEngine, keyPacket, pointerPacket, wheelPacket } from "../src/index";

describe("@modeling-kit/input", () => {
  it("fires edit.undo from Control+KeyZ and ignores repeats", () => {
    const engine = createInputEngine();
    const actions: string[] = [];
    engine.onAction("edit.undo", (ctx) => actions.push(ctx.action));
    engine.dispatch(
      keyPacket({ kind: "keydown", code: "KeyZ", modifiers: { ctrl: true } }),
    );
    engine.dispatch(
      keyPacket({ kind: "keydown", code: "KeyZ", repeat: true, modifiers: { ctrl: true } }),
    );
    expect(actions).toEqual(["edit.undo"]);
  });

  it("swallows shortcuts in focus.text", () => {
    const engine = createInputEngine();
    let undo = 0;
    engine.onAction("edit.undo", () => {
      undo += 1;
    });
    engine.pushContext("focus.text");
    const result = engine.dispatch(
      keyPacket({ kind: "keydown", code: "KeyZ", modifiers: { ctrl: true } }),
    );
    expect(result.consumed).toBe(false);
    expect(undo).toBe(0);
  });

  it("reads axes before endFrame and keeps held keys", () => {
    const engine = createInputEngine();
    engine.dispatch(keyPacket({ kind: "keydown", code: "KeyW" }));
    engine.dispatch(wheelPacket({ deltaY: 40 }));
    engine.dispatch(
      pointerPacket({ kind: "pointerdown", button: "primary", canvas: { x: 0, y: 0 } }),
    );
    engine.dispatch(
      pointerPacket({ kind: "pointermove", canvas: { x: 8, y: 2 } }),
    );
    const before = engine.axes();
    expect(before.moveZ).toBe(1);
    expect(before.zoom).toBe(40);
    expect(before.orbitX).toBe(8);
    expect(engine.key("KeyW").down).toBe(true);
    expect(engine.key("KeyW").pressedThisFrame).toBe(true);
    engine.endFrame();
    const after = engine.axes();
    expect(after.moveZ).toBe(1);
    expect(after.zoom).toBe(0);
    expect(after.orbitX).toBe(0);
    expect(engine.key("KeyW").down).toBe(true);
    expect(engine.key("KeyW").pressedThisFrame).toBe(false);
    engine.dispatch(keyPacket({ kind: "keyup", code: "KeyW" }));
    expect(engine.axes().moveZ).toBe(0);
    expect(engine.key("KeyW").releasedThisFrame).toBe(true);
  });

  it("does not request pointer capture on a select-click down", () => {
    const engine = createInputEngine();
    const down = engine.dispatch(
      pointerPacket({ kind: "pointerdown", button: "primary", canvas: { x: 0, y: 0 } }),
    );
    expect(down.capturePointer).toBeFalsy();
    expect(down.consumed).toBe(true);
    const up = engine.dispatch(
      pointerPacket({ kind: "pointerup", button: "primary", canvas: { x: 1, y: 0 }, buttons: 0 }),
    );
    expect(up.capturePointer).toBeFalsy();
  });

  it("requests pointer capture when a claimed drag gesture begins", () => {
    const engine = createInputEngine({ slopPx: 4 });
    engine.onGesture("transform.slide", {
      begin: () => undefined,
      update: () => undefined,
      commit: () => undefined,
      cancel: () => undefined,
    });
    const down = engine.dispatch(
      pointerPacket({
        kind: "pointerdown",
        button: "primary",
        canvas: { x: 0, y: 0 },
        modifiers: { shift: true },
      }),
    );
    expect(down.capturePointer).toBeFalsy();
    const move = engine.dispatch(
      pointerPacket({
        kind: "pointermove",
        canvas: { x: 10, y: 0 },
        modifiers: { shift: true },
      }),
    );
    expect(move.capturePointer).toBe(true);
    expect(move.consumed).toBe(true);
  });

  it("picks on primary tap and slides after slop with Shift", () => {
    const engine = createInputEngine({ slopPx: 4 });
    const picks: number[] = [];
    const phases: string[] = [];
    engine.onAction("select.pick", () => picks.push(1));
    engine.onGesture("transform.slide", {
      begin: () => phases.push("begin"),
      update: () => phases.push("update"),
      commit: () => phases.push("commit"),
      cancel: () => phases.push("cancel"),
    });

    engine.dispatch(
      pointerPacket({ kind: "pointerdown", button: "primary", canvas: { x: 10, y: 10 } }),
    );
    engine.dispatch(
      pointerPacket({ kind: "pointerup", button: "primary", canvas: { x: 11, y: 10 }, buttons: 0 }),
    );
    expect(picks).toEqual([1]);
    expect(phases).toEqual([]);

    engine.dispatch(
      pointerPacket({
        kind: "pointerdown",
        button: "primary",
        canvas: { x: 0, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(
      pointerPacket({
        kind: "pointermove",
        canvas: { x: 10, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(
      pointerPacket({
        kind: "pointerup",
        button: "primary",
        canvas: { x: 12, y: 0 },
        buttons: 0,
        modifiers: { shift: true },
      }),
    );
    expect(phases).toEqual(["begin", "update", "commit"]);
    expect(picks).toEqual([1]);
  });

  it("cancels an in-progress drag on Escape with no commit", () => {
    const engine = createInputEngine({ slopPx: 4 });
    const phases: string[] = [];
    engine.onGesture("transform.slide", {
      begin: () => phases.push("begin"),
      update: () => phases.push("update"),
      commit: () => phases.push("commit"),
      cancel: () => phases.push("cancel"),
    });
    engine.dispatch(
      pointerPacket({
        kind: "pointerdown",
        button: "primary",
        canvas: { x: 0, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(
      pointerPacket({
        kind: "pointermove",
        canvas: { x: 20, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(keyPacket({ kind: "keydown", code: "Escape" }));
    expect(phases).toEqual(["begin", "update", "cancel"]);
    expect(engine.isGesturing).toBe(false);
  });

  it("does not fire undo while a transform gesture is active", () => {
    const engine = createInputEngine({ slopPx: 4 });
    let undo = 0;
    engine.onAction("edit.undo", () => {
      undo += 1;
    });
    engine.dispatch(
      pointerPacket({
        kind: "pointerdown",
        button: "primary",
        canvas: { x: 0, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(
      pointerPacket({
        kind: "pointermove",
        canvas: { x: 20, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(keyPacket({ kind: "keydown", code: "KeyZ", modifiers: { ctrl: true } }));
    expect(undo).toBe(0);
  });

  it("fires tool.confirm on Enter while modal.knife is exclusive", () => {
    const engine = createInputEngine();
    const actions: string[] = [];
    engine.onAction("tool.confirm", (ctx) => actions.push(ctx.action));
    engine.onAction("edit.undo", () => actions.push("undo"));
    engine.pushContext("viewport.model");
    engine.pushContext("modal.knife");
    engine.dispatch(keyPacket({ kind: "keydown", code: "Enter" }));
    engine.dispatch(keyPacket({ kind: "keydown", code: "KeyZ", modifiers: { ctrl: true } }));
    expect(actions).toEqual(["tool.confirm"]);
  });

  it("cancels an open gesture and drops handlers on dispose", () => {
    const engine = createInputEngine({ slopPx: 4 });
    const phases: string[] = [];
    engine.onGesture("transform.slide", {
      begin: () => phases.push("begin"),
      update: () => phases.push("update"),
      commit: () => phases.push("commit"),
      cancel: () => phases.push("cancel"),
    });
    engine.dispatch(
      pointerPacket({
        kind: "pointerdown",
        button: "primary",
        canvas: { x: 0, y: 0 },
        modifiers: { shift: true },
      }),
    );
    engine.dispatch(
      pointerPacket({
        kind: "pointermove",
        canvas: { x: 20, y: 0 },
        modifiers: { shift: true },
      }),
    );
    expect(engine.isGesturing).toBe(true);
    engine.dispose();
    expect(phases).toContain("cancel");
    expect(phases).not.toContain("commit");
    expect(() =>
      engine.dispatch(keyPacket({ kind: "keydown", code: "KeyZ", modifiers: { ctrl: true } })),
    ).toThrow(/disposed/);
    engine.dispose();
  });

  it("exposes DOM binding as an optional package export", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkg = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(pkg.exports["."]).toBeTruthy();
    expect(pkg.exports["./dom"]).toBeTruthy();
    const engineSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/engine.ts"),
      "utf8",
    );
    expect(engineSrc).not.toMatch(/HTMLElement|document\.|window\./);
  });
});
