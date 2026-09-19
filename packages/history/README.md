# @modeling-kit/history

**Undo/redo system with command pattern.** Every state-changing operation in The Block SDK is wrapped in a `Command` that can be executed, undone, and redone.

## Purpose

The `history` package provides:

- **CommandManager** — the main undo/redo stack with configurable depth
- **Command interface** — `execute()`, `undo()`, `redo()` with typed context
- **CompositeCommand** — groups multiple commands into a single undoable unit
- **PreviewSession** — temporary state changes that can be committed or rolled back (used for transform previews, tool previews)
- **Error handling** — `HistoryFailureError` with partial rollback records when undo fails

## Key Exports

```ts
import {
  CommandManager,
  CompositeCommand,
  PreviewSession,
  HistoryFailureError,
  type Command,
  type CommandContext,
  type CommandRecord,
  type SerializedCommand,
  type HistoryOperation,
  type PartialRollbackRecord,
} from "@modeling-kit/history";
```

## Usage Example

```ts
import { CommandManager } from "@modeling-kit/history";
import type { Command, CommandContext } from "@modeling-kit/history";

class MoveVertexCommand implements Command {
  readonly name = "Move Vertex";
  constructor(
    private meshId: string,
    private vertexId: string,
    private newPos: [number, number, number],
    private oldPos: [number, number, number],
  ) {}

  execute(ctx: CommandContext): void {
    const mesh = ctx.session.store.get(this.meshId);
    // apply newPos...
  }

  undo(ctx: CommandContext): void {
    // restore oldPos...
  }

  redo(ctx: CommandContext): void {
    this.execute(ctx);
  }
}

const manager = new CommandManager({ maxUndoDepth: 100 });

// Execute
const cmd = new MoveVertexCommand("mesh-1", "v-0", [1, 2, 3], [0, 0, 0]);
manager.execute(cmd);

// Undo
manager.undo();  // moves back to [0, 0, 0]

// Redo
manager.redo();  // moves back to [1, 2, 3]
```

```ts
import { CompositeCommand } from "@modeling-kit/history";

// Group multiple operations into one undo step
const composite = new CompositeCommand("Add Window", [
  extrudeCommand,
  insetCommand,
]);
manager.execute(composite);
// A single undo will reverse all three operations
```

## Architecture Notes

- Commands receive a `CommandContext` containing the `ModelingSession`, document store, and optional selection manager — every command has full access to the document.
- `execute()` is called once (when the user performs the action), `undo()`/`redo()` may be called many times.
- Commands should store **all data needed for undo** internally — do not reference live state that may change.
- `CommandManager.undo()` and `redo()` maintain a stack pointer. New commands after an undo clear the redo stack.
- `PreviewSession` allows temporary edits (like transform drag previews) that can be either committed (pushed to history) or discarded on cancel.