import { HistoryFailureError } from "./errors";
import type { Command, CommandContext } from "./types";

export class CompositeCommand implements Command<unknown> {
  readonly id: string;
  readonly label: string;
  private readonly commands: Command[];

  constructor(label: string, commands: Command[], id = crypto.randomUUID()) {
    this.id = id;
    this.label = label;
    this.commands = [...commands];
  }

  get commandIds(): readonly string[] {
    return this.commands.map((command) => command.id);
  }

  execute(context: CommandContext): unknown {
    let ran = 0;
    try {
      let result: unknown;
      for (const command of this.commands) {
        result = command.execute(context);
        ran += 1;
      }
      return result;
    } catch (cause) {
      this.rollbackExecuted(context, ran, "execute", cause);
      throw cause;
    }
  }

  undo(context: CommandContext): void {
    const completed: string[] = [];
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const command = this.commands[i]!;
      try {
        command.undo(context);
        completed.push(command.id);
      } catch (cause) {
        throw new HistoryFailureError(
          `Composite undo failed for command '${command.label}' (${command.id})`,
          {
            operation: "undo",
            commandId: command.id,
            commandLabel: command.label,
            remainingCommandIds: this.commands.slice(0, i + 1).map((item) => item.id),
            completedCommandIds: completed,
            cause,
          },
        );
      }
    }
  }

  redo(context: CommandContext): unknown {
    let ran = 0;
    try {
      let result: unknown;
      for (const command of this.commands) {
        result = command.redo ? command.redo(context) : command.execute(context);
        ran += 1;
      }
      return result;
    } catch (cause) {
      this.rollbackExecuted(context, ran, "redo", cause);
      throw cause;
    }
  }

  private rollbackExecuted(
    context: CommandContext,
    ran: number,
    operation: "execute" | "redo",
    cause: unknown,
  ): void {
    const completed: string[] = [];
    for (let i = ran - 1; i >= 0; i--) {
      const command = this.commands[i]!;
      try {
        command.undo(context);
        completed.push(command.id);
      } catch (rollbackCause) {
        throw new HistoryFailureError(
          `Composite ${operation} failed (${causeMessage(cause)}) and rollback was incomplete at '${command.label}' (${command.id}): ${causeMessage(rollbackCause)}`,
          {
            operation: "rollback",
            commandId: command.id,
            commandLabel: command.label,
            remainingCommandIds: this.commands.slice(0, i + 1).map((item) => item.id),
            completedCommandIds: completed,
            cause: rollbackCause,
            originalCause: cause,
          },
        );
      }
    }
  }
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
