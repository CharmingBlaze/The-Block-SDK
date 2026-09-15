import { describe, expect, it } from "vitest";
import type { Command, CommandContext } from "../src/index";
import { CommandManager, CompositeCommand, HistoryFailureError } from "../src/index";
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

  it("keeps a command on the undo stack when undo throws", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    class FlakyUndo implements Command<void> {
      readonly id = "flaky-undo";
      readonly label = "flaky-undo";
      execute(): void {
        store.value += 1;
      }
      undo(): void {
        throw new Error("undo exploded");
      }
    }
    history.execute(new FlakyUndo(), context);
    expect(() => history.undo(context)).toThrow(/undo exploded/);
    expect(history.undoStack).toHaveLength(1);
    expect(history.redoStack).toHaveLength(0);
    expect(history.undoStack[0]?.id).toBe("flaky-undo");
  });

  it("keeps a command on the redo stack when redo throws", () => {
    const history = new CommandManager();
    const context = dummyContext();
    class FlakyRedo implements Command<void> {
      readonly id = "flaky-redo";
      readonly label = "flaky-redo";
      execute(): void {
        return;
      }
      undo(): void {
        return;
      }
      redo(): void {
        throw new Error("redo exploded");
      }
    }
    history.execute(new FlakyRedo(), context);
    history.undo(context);
    expect(() => history.redo(context)).toThrow(/redo exploded/);
    expect(history.redoStack).toHaveLength(1);
    expect(history.undoStack).toHaveLength(0);
  });

  it("keeps remaining transaction commands when rollback throws", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    class FlakyUndo implements Command<void> {
      readonly id = "tx-flaky";
      readonly label = "tx-flaky";
      execute(): void {
        store.value += 4;
      }
      undo(): void {
        throw new Error("rollback exploded");
      }
    }
    history.beginTransaction();
    history.execute(new CounterCommand(1, store, "inc-a"), context);
    history.execute(new FlakyUndo(), context);
    expect(() => history.rollbackTransaction(context)).toThrow(/rollback exploded/);
    expect(history.transactionDepth).toBe(1);
    expect(store.value).toBe(5);
    expect(history.pendingTransactionCommands.map((item) => item.id)).toEqual(["inc-a", "tx-flaky"]);
    expect(history.lastFailure).toBeInstanceOf(HistoryFailureError);
    expect(history.lastFailure?.operation).toBe("rollback");
    expect(history.lastFailure?.remainingCommandIds).toEqual(["inc-a", "tx-flaky"]);
    expect(history.lastFailure?.completedCommandIds).toEqual([]);
  });

  it("keeps a recoverable record when rollback stops after a successful undo", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    class FlakyFirst implements Command<void> {
      readonly id = "tx-first-flaky";
      readonly label = "tx-first-flaky";
      execute(): void {
        store.value += 4;
      }
      undo(): void {
        throw new Error("first undo exploded");
      }
    }
    history.beginTransaction();
    history.execute(new FlakyFirst(), context);
    history.execute(new CounterCommand(1, store, "inc-tail"), context);
    expect(store.value).toBe(5);
    expect(() => history.rollbackTransaction(context)).toThrow(/first undo exploded/);
    expect(history.transactionDepth).toBe(1);
    expect(store.value).toBe(4);
    expect(history.pendingTransactionCommands.map((item) => item.id)).toEqual(["tx-first-flaky"]);
    expect(history.lastFailure?.remainingCommandIds).toEqual(["tx-first-flaky"]);
    expect(history.lastFailure?.completedCommandIds).toEqual(["inc-tail"]);
  });

  it("aggregates the original composite failure when rollback also throws", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    class FlakyInc implements Command<void> {
      readonly id = "flaky-inc";
      readonly label = "flaky-inc";
      execute(): void {
        store.value += 3;
      }
      undo(): void {
        throw new Error("undo exploded");
      }
    }
    class Boom implements Command<void> {
      readonly id = "boom";
      readonly label = "boom";
      execute(): void {
        throw new Error("second failed");
      }
      undo(): void {
        return;
      }
    }
    let caught: unknown;
    try {
      history.execute(new CompositeCommand("pair", [new FlakyInc(), new Boom()]), context);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HistoryFailureError);
    const failure = caught as HistoryFailureError;
    expect(failure.operation).toBe("rollback");
    expect(failure.message).toMatch(/second failed/);
    expect(failure.message).toMatch(/undo exploded/);
    expect((failure.cause as Error).message).toBe("undo exploded");
    expect((failure.originalCause as Error).message).toBe("second failed");
    expect(failure.remainingCommandIds).toEqual(["flaky-inc"]);
    expect(store.value).toBe(3);
    expect(history.undoStack).toHaveLength(0);
    expect(history.lastFailure).toBe(failure);
  });

  it("does not merge across the saved-state command", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    history.execute(new CounterCommand(1, store, "A"), context);
    history.markSaved();
    history.execute(new CounterCommand(2, store, "B"), context);
    expect(history.undoStack.map((item) => item.id)).toEqual(["A", "B"]);
    expect(history.isDirty).toBe(true);
    history.undo(context);
    expect(store.value).toBe(1);
    expect(history.isDirty).toBe(false);
  });

  it("keeps dirty true after the saved command is trimmed", () => {
    const history = new CommandManager();
    history.maxHistoryDepth = 2;
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
    history.execute(new Step("A"), context);
    history.markSaved();
    history.execute(new Step("B"), context);
    history.execute(new Step("C"), context);
    expect(history.undoStack.map((item) => item.id)).toEqual(["B", "C"]);
    expect(history.isSavedStateReachable).toBe(false);
    expect(history.isDirty).toBe(true);
    history.undo(context);
    history.undo(context);
    expect(history.undoStack).toHaveLength(0);
    expect(history.isDirty).toBe(true);
    expect(history.isSavedStateReachable).toBe(false);
  });

  it("marks the document dirty after save, undo, and a new branch", () => {
    const history = new CommandManager();
    const context = dummyContext();
    const store = { value: 0 };
    history.execute(new CounterCommand(1, store, "A"), context);
    history.markSaved();
    expect(history.isDirty).toBe(false);
    history.undo(context);
    history.execute(new CounterCommand(9, store, "B"), context);
    expect(history.undoStack).toHaveLength(1);
    expect(history.isDirty).toBe(true);
  });
});
