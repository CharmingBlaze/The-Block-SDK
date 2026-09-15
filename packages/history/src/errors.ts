export type HistoryOperation = "execute" | "undo" | "redo" | "rollback";

export interface HistoryFailureOptions {
  readonly operation: HistoryOperation;
  readonly commandId?: string | undefined;
  readonly commandLabel?: string | undefined;
  readonly remainingCommandIds?: readonly string[] | undefined;
  readonly completedCommandIds?: readonly string[] | undefined;
  /** Immediate failure (undo/redo/rollback throw). */
  readonly cause?: unknown;
  /** Original execute/redo error when rollback of a composite also failed. */
  readonly originalCause?: unknown;
}

export interface PartialRollbackRecord {
  readonly operation: HistoryOperation;
  readonly commandId?: string | undefined;
  readonly commandLabel?: string | undefined;
  readonly remainingCommandIds: readonly string[];
  readonly completedCommandIds: readonly string[];
  readonly cause?: unknown;
  readonly originalCause?: unknown;
}

/**
 * Raised when a history mutation fails. The manager keeps the command on its
 * original stack so the caller can inspect remaining work and retry.
 */
export class HistoryFailureError extends Error {
  readonly operation: HistoryOperation;
  readonly commandId?: string | undefined;
  readonly commandLabel?: string | undefined;
  readonly remainingCommandIds: readonly string[];
  readonly completedCommandIds: readonly string[];
  override readonly cause?: unknown;
  readonly originalCause?: unknown;

  constructor(message: string, options: HistoryFailureOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "HistoryFailureError";
    this.operation = options.operation;
    this.commandId = options.commandId;
    this.commandLabel = options.commandLabel;
    this.remainingCommandIds = options.remainingCommandIds ?? [];
    this.completedCommandIds = options.completedCommandIds ?? [];
    this.cause = options.cause;
    this.originalCause = options.originalCause;
  }

  toRecord(): PartialRollbackRecord {
    return {
      operation: this.operation,
      ...(this.commandId !== undefined ? { commandId: this.commandId } : {}),
      ...(this.commandLabel !== undefined ? { commandLabel: this.commandLabel } : {}),
      remainingCommandIds: this.remainingCommandIds,
      completedCommandIds: this.completedCommandIds,
      ...(this.cause !== undefined ? { cause: this.cause } : {}),
      ...(this.originalCause !== undefined ? { originalCause: this.originalCause } : {}),
    };
  }
}
