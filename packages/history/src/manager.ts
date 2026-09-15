import type { HistoryState } from "@modeling-kit/core";
import { CompositeCommand } from "./composite";
import { HistoryFailureError } from "./errors";
import type { Command, CommandContext, CommandRecord } from "./types";

interface HistoryEntry {
  readonly command: Command;
  /** Identity of the document after this command succeeded. */
  readonly stateId: number;
}

/** Sentinel: the saved command was trimmed and cannot be restored. */
const UNREACHABLE_SAVED_STATE = Number.NaN;

export class CommandManager {
  private undoItems: HistoryEntry[] = [];
  private redoItems: HistoryEntry[] = [];
  private currentStateId = 0;
  private savedStateId: number = 0;
  private nextStateId = 1;
  private readonly transactions: Command[][] = [];
  private busy = false;
  private disposed = false;
  private lastFailureError: HistoryFailureError | undefined;
  maxHistoryDepth = 256;

  constructor(private readonly emitHistory?: (state: HistoryState) => void) {}

  get canUndo(): boolean {
    return this.undoItems.length > 0;
  }

  get canRedo(): boolean {
    return this.redoItems.length > 0;
  }

  get isDirty(): boolean {
    return !this.isSavedStateReachable || this.currentStateId !== this.savedStateId;
  }

  get isSavedStateReachable(): boolean {
    return !Number.isNaN(this.savedStateId);
  }

  get lastFailure(): HistoryFailureError | undefined {
    return this.lastFailureError;
  }

  get pendingTransactionCommands(): readonly CommandRecord[] {
    const batch = this.transactions[this.transactions.length - 1];
    if (!batch) {
      return [];
    }
    return batch.map((command) => ({ id: command.id, label: command.label }));
  }

  get transactionDepth(): number {
    return this.transactions.length;
  }

  get inTransaction(): boolean {
    return this.transactions.length > 0;
  }

  get undoStack(): readonly CommandRecord[] {
    return this.undoItems.map((entry) => ({ id: entry.command.id, label: entry.command.label }));
  }

  get redoStack(): readonly CommandRecord[] {
    return this.redoItems.map((entry) => ({ id: entry.command.id, label: entry.command.label }));
  }

  execute<T>(command: Command<T>, context: CommandContext): T {
    this.assertOpen();
    this.enter();
    try {
      let result: T;
      try {
        result = command.execute(context);
      } catch (cause) {
        if (cause instanceof HistoryFailureError) {
          this.fail(cause);
        }
        throw cause;
      }
      this.lastFailureError = undefined;
      const currentTx = this.transactions[this.transactions.length - 1];
      if (currentTx) {
        currentTx.push(command as Command);
        return result;
      }
      const last = this.undoItems[this.undoItems.length - 1];
      const canMerge =
        last !== undefined &&
        last.command.mergeWith !== undefined &&
        last.stateId !== this.savedStateId;
      if (canMerge && last.command.mergeWith) {
        const merged = last.command.mergeWith(command as Command);
        if (merged) {
          const stateId = this.allocateStateId();
          this.undoItems[this.undoItems.length - 1] = { command: merged, stateId };
          this.currentStateId = stateId;
          this.redoItems = [];
          this.notify();
          return result;
        }
      }
      const stateId = this.allocateStateId();
      this.undoItems.push({ command: command as Command, stateId });
      this.currentStateId = stateId;
      this.redoItems = [];
      this.trim();
      this.notify();
      return result;
    } finally {
      this.leave();
    }
  }

  undo(context: CommandContext): void {
    this.assertOpen();
    if (this.inTransaction) {
      throw new Error("Cannot undo while a history transaction is open; commit or rollback first");
    }
    this.enter();
    try {
      const entry = this.undoItems[this.undoItems.length - 1];
      if (!entry) {
        return;
      }
      try {
        entry.command.undo(context);
      } catch (cause) {
        this.fail(
          new HistoryFailureError(
            `Undo failed for command '${entry.command.label}' (${entry.command.id}): ${causeMessage(cause)}`,
            {
              operation: "undo",
              commandId: entry.command.id,
              commandLabel: entry.command.label,
              remainingCommandIds: this.undoItems.map((item) => item.command.id),
              cause,
            },
          ),
        );
      }
      this.lastFailureError = undefined;
      this.undoItems.pop();
      this.redoItems.push(entry);
      this.currentStateId = this.undoItems[this.undoItems.length - 1]?.stateId ?? 0;
      this.notify();
    } finally {
      this.leave();
    }
  }

  redo(context: CommandContext): void {
    this.assertOpen();
    if (this.inTransaction) {
      throw new Error("Cannot redo while a history transaction is open; commit or rollback first");
    }
    this.enter();
    try {
      const entry = this.redoItems[this.redoItems.length - 1];
      if (!entry) {
        return;
      }
      try {
        if (entry.command.redo) {
          entry.command.redo(context);
        } else {
          entry.command.execute(context);
        }
      } catch (cause) {
        this.fail(
          new HistoryFailureError(
            `Redo failed for command '${entry.command.label}' (${entry.command.id}): ${causeMessage(cause)}`,
            {
              operation: "redo",
              commandId: entry.command.id,
              commandLabel: entry.command.label,
              remainingCommandIds: this.redoItems.map((item) => item.command.id),
              cause,
            },
          ),
        );
      }
      this.lastFailureError = undefined;
      this.redoItems.pop();
      this.undoItems.push(entry);
      this.currentStateId = entry.stateId;
      this.notify();
    } finally {
      this.leave();
    }
  }

  beginTransaction(): void {
    this.assertOpen();
    if (this.busy) {
      throw new Error("Cannot begin a history transaction while execute/undo/redo is running");
    }
    this.transactions.push([]);
    this.notify();
  }

  commitTransaction(label: string): void {
    this.assertOpen();
    const batch = this.transactions[this.transactions.length - 1];
    if (!batch) {
      return;
    }
    this.lastFailureError = undefined;
    if (batch.length === 0) {
      this.transactions.pop();
      this.notify();
      return;
    }
    const composite = new CompositeCommand(label, batch);
    this.transactions.pop();
    if (this.transactions.length > 0) {
      this.transactions[this.transactions.length - 1]!.push(composite);
      this.notify();
      return;
    }
    const stateId = this.allocateStateId();
    this.undoItems.push({ command: composite, stateId });
    this.currentStateId = stateId;
    this.redoItems = [];
    this.trim();
    this.notify();
  }

  rollbackTransaction(context: CommandContext): void {
    this.assertOpen();
    const batch = this.transactions[this.transactions.length - 1];
    if (!batch) {
      return;
    }
    const completed: string[] = [];
    while (batch.length > 0) {
      const command = batch[batch.length - 1]!;
      try {
        command.undo(context);
      } catch (cause) {
        this.fail(
          new HistoryFailureError(
            `Transaction rollback failed for command '${command.label}' (${command.id}): ${causeMessage(cause)}`,
            {
              operation: "rollback",
              commandId: command.id,
              commandLabel: command.label,
              remainingCommandIds: batch.map((item) => item.id),
              completedCommandIds: completed,
              cause,
            },
          ),
        );
      }
      batch.pop();
      completed.push(command.id);
    }
    this.lastFailureError = undefined;
    this.transactions.pop();
    this.notify();
  }

  markSaved(): void {
    this.savedStateId = this.currentStateId;
    this.notify();
  }

  clear(): void {
    this.undoItems = [];
    this.redoItems = [];
    this.currentStateId = 0;
    this.savedStateId = 0;
    this.nextStateId = 1;
    this.transactions.length = 0;
    this.lastFailureError = undefined;
    this.notify();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.undoItems = [];
    this.redoItems = [];
    this.transactions.length = 0;
    this.currentStateId = 0;
    this.savedStateId = 0;
    this.nextStateId = 1;
    this.lastFailureError = undefined;
    this.notify();
  }

  private allocateStateId(): number {
    const id = this.nextStateId;
    this.nextStateId += 1;
    return id;
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("CommandManager is disposed");
    }
  }

  private enter(): void {
    if (this.busy) {
      throw new Error("History is re-entrant; commands must not execute other commands");
    }
    this.busy = true;
  }

  private leave(): void {
    this.busy = false;
  }

  private trim(): void {
    if (this.undoItems.length <= this.maxHistoryDepth) {
      return;
    }
    const extra = this.undoItems.length - this.maxHistoryDepth;
    const removed = this.undoItems.splice(0, extra);
    if (this.isSavedStateReachable && removed.some((entry) => entry.stateId === this.savedStateId)) {
      this.savedStateId = UNREACHABLE_SAVED_STATE;
    }
  }

  private fail(error: HistoryFailureError): never {
    this.lastFailureError = error;
    this.notify();
    throw error;
  }

  private notify(): void {
    this.emitHistory?.({
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      isDirty: this.isDirty,
      undoCount: this.undoItems.length,
      redoCount: this.redoItems.length,
      transactionDepth: this.transactions.length,
      isSavedStateReachable: this.isSavedStateReachable,
      hasPartialRollback: this.lastFailureError?.operation === "rollback",
    });
  }
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
