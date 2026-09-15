export interface IoCancelOptions {
  readonly signal?: AbortSignal;
}

export function throwIfAborted(signal: AbortSignal | undefined, label: string): void {
  if (signal?.aborted) {
    throw new Error(`${label} cancelled`);
  }
}
