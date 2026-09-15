import type { HistoryState } from "@modeling-kit/core";
import { CompositeCommand } from "./composite";
import type { Command, CommandContext, CommandRecord } from "./types";

export class CommandManager {
  private undoItems: Command[] = [];
  private redoItems: Command[] = [];
  private saveIndex = 0;
  private readonly transactions: Command[][] = [];
  private busy = false;
  private disposed = false;
  maxHistoryDepth = 256;

  constructor(private readonly emitHistory?: (state: HistoryState) => void) {}

  get canUndo(): boolean {
    return this.undoItems.length > 0;
  }

  get canRedo(): boolean {
    return this.redoItems.length > 0;
  }

  get isDirty(): boolean {
    return this.undoItems.length !== this.saveIndex;
  }

  get transactionDepth(): number {
    return this.transactions.length;
  }

  get inTransaction(): boolean {
    return this.transactions.length > 0;
  }

  get undoStack(): readonly CommandRecord[] {
    return this.undoItems.map((command) => ({ id: command.id, label: command.label }));
  }

  get redoStack(): readonly CommandRecord[] {
    return this.redoItems.map((command) => ({ id: command.id, label: command.label }));
  }

  execute<T>(command: Command<T>, context: CommandContext): T {
    this.assertOpen();
    this.enter();
    try {
      const result = command.execute(context);
      const currentTx = this.transactions[this.transactions.length - 1];
      if (currentTx) {
        currentTx.push(command as Command);
        return result;
      }
      const last = this.undoItems[this.undoItems.length - 1];
      if (last?.mergeWith) {
        const merged = last.mergeWith(command as Command);
        if (merged) {
          this.undoItems[this.undoItems.length - 1] = merged;
          this.redoItems = [];
          this.notify();
          return result;
        }
      }
      this.undoItems.push(command as Command);
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
      const command = this.undoItems.pop();
      if (!command) {
        return;
      }
      command.undo(context);
      this.redoItems.push(command);
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
      const command = this.redoItems.pop();
      if (!command) {
        return;
      }
      if (command.redo) {
        command.redo(context);
      } else {
        command.execute(context);
      }
      this.undoItems.push(command);
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
    const batch = this.transactions.pop();
    if (!batch || batch.length === 0) {
      this.notify();
      return;
    }
    const composite = new CompositeCommand(label, batch);
    if (this.transactions.length > 0) {
      this.transactions[this.transactions.length - 1]!.push(composite);
      this.notify();
      return;
    }
    this.undoItems.push(composite);
    this.redoItems = [];
    this.trim();
    this.notify();
  }

  rollbackTransaction(context: CommandContext): void {
    this.assertOpen();
    const batch = this.transactions.pop();
    if (!batch) {
      return;
    }
    for (let i = batch.length - 1; i >= 0; i--) {
      batch[i]!.undo(context);
    }
    this.notify();
  }

  markSaved(): void {
    this.saveIndex = this.undoItems.length;
    this.notify();
  }

  clear(): void {
    this.undoItems = [];
    this.redoItems = [];
    this.saveIndex = 0;
    this.transactions.length = 0;
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
    this.saveIndex = 0;
    this.notify();
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
    if (this.undoItems.length > this.maxHistoryDepth) {
      const extra = this.undoItems.length - this.maxHistoryDepth;
      this.undoItems.splice(0, extra);
      this.saveIndex = Math.max(0, this.saveIndex - extra);
    }
  }

  private notify(): void {
    this.emitHistory?.({
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      isDirty: this.isDirty,
      undoCount: this.undoItems.length,
      redoCount: this.redoItems.length,
      transactionDepth: this.transactions.length,
    });
  }
}
