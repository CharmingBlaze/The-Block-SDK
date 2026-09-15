import { describe, expect, it } from "vitest";
import type { Command, CommandContext } from "../src/index";
import { CommandManager, CompositeCommand } from "../src/index";
import { Emitter } from "@modeling-kit/core";
import { createModelDocument } from "@modeling-kit/document";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { SelectionManager } from "@modeling-kit/selection";

class CounterCommand implements Command<number> {
  readonly id: string;
  readonly label = "inc";
  constructor(
    readonly amount: number,
    private readonly store: { value: number },
    id?: string,
  ) {
    this.id = id ?? crypto.randomUUID();
  }
  execute(): number {
    this.store.value += this.amount;
    return this.store.value;
  }
  undo(): void {
    this.store.value -= this.amount;
  }
  mergeWith(next: Command): Command | null {
    if (next instanceof CounterCommand && next.store === this.store) {
      return new CounterCommand(this.amount + next.amount, this.store, this.id);
    }
    return null;
  }
}

function dummyContext(): CommandContext {
  return {
    document: createModelDocument({ ids: createSequenceIdFactory("h") }),
    ids: createSequenceIdFactory("h"),
    selection: new SelectionManager(),
    meshes: new Map(),
    textures: new Map(),
    events: new Emitter(),
    syncMesh: () => undefined,
  };
}

describe("CommandManager", () => {
  it("undoes, redoes, merges, and rolls back transactions", () => {
    const store = { value: 0 };
    const history = new CommandManager();
    const context = dummyContext();
    history.execute(new CounterCommand(1, store), context);
    history.execute(new CounterCommand(2, store), context);
    expect(store.value).toBe(3);
    expect(history.undoStack).toHaveLength(1);
    history.undo(context);
    expect(store.value).toBe(0);
    history.redo(context);
    expect(store.value).toBe(3);

    history.beginTransaction();
    history.execute(new CounterCommand(5, store), context);
    history.rollbackTransaction(context);
    expect(store.value).toBe(3);
    expect(history.undoStack).toHaveLength(1);
  });

  it("does not record a command that throws", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    class Boom implements Command<void> {
      readonly id = "boom";
      readonly label = "boom";
      execute(): void {
        throw new Error("nope");
      }
      undo(): void {
        store.value -= 1;
      }
    }
    expect(() => history.execute(new Boom(), context)).toThrow("nope");
    expect(history.undoStack).toHaveLength(0);
    expect(store.value).toBe(0);
  });

  it("rolls back earlier commands when a composite execute fails", () => {
    const store = { value: 0 };
    const history = new CommandManager();
    const context = dummyContext();
    class BoomAfter implements Command<void> {
      readonly id = "boom-after";
      readonly label = "boom-after";
      execute(): void {
        throw new Error("second failed");
      }
      undo(): void {
        return;
      }
    }
    expect(() =>
      history.execute(new CompositeCommand("pair", [new CounterCommand(4, store), new BoomAfter()]), context),
    ).toThrow("second failed");
    expect(store.value).toBe(0);
    expect(history.undoStack).toHaveLength(0);
  });

  it("trims the undo stack to maxHistoryDepth", () => {
    const history = new CommandManager();
    history.maxHistoryDepth = 3;
    const context = dummyContext();
    class Step implements Command<void> {
      readonly label = "step";
      constructor(readonly id: string) {}
      execute(): void {
        return;
      }
      undo(): void {
        return;
      }
    }
    history.execute(new Step("a"), context);
    history.execute(new Step("b"), context);
    history.execute(new Step("c"), context);
    history.execute(new Step("d"), context);
    expect(history.undoStack.map((item) => item.id)).toEqual(["b", "c", "d"]);
  });
});
