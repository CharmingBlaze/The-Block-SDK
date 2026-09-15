import type { CommandContext } from "./types";

export class PreviewSession<TSnapshot> {
  private committed = false;

  constructor(
    private readonly snapshot: TSnapshot,
    private readonly restore: (snapshot: TSnapshot, context: CommandContext) => void,
  ) {}

  cancel(context: CommandContext): void {
    if (this.committed) {
      return;
    }
    this.restore(this.snapshot, context);
  }

  markCommitted(): void {
    this.committed = true;
  }
}
