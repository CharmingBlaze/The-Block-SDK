import type { Command, CommandContext } from "./types";

export class CompositeCommand implements Command<unknown> {
  readonly id: string;
  readonly label: string;
  private readonly commands: Command[];

  constructor(label: string, commands: Command[], id = crypto.randomUUID()) {
    this.id = id;
    this.label = label;
    this.commands = commands;
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
    } catch (error) {
      for (let i = ran - 1; i >= 0; i--) {
        this.commands[i]!.undo(context);
      }
      throw error;
    }
  }

  undo(context: CommandContext): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]!.undo(context);
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
    } catch (error) {
      for (let i = ran - 1; i >= 0; i--) {
        this.commands[i]!.undo(context);
      }
      throw error;
    }
  }
}
