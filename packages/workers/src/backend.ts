export type ComputeBackend = "inline" | "browser-worker" | "worker-threads";

export interface ComputeWorkerSession {
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void;
  terminate(): void;
}

export interface ComputeWorkerHandlers {
  readonly onMessage: (data: unknown) => void;
  readonly onError: (error: unknown) => void;
  readonly onExit?: (code?: number) => void;
}

export interface ComputeWorkerBackend {
  readonly kind: ComputeBackend;
  readonly concurrency: number;
  spawn(): ComputeWorkerSession;
  subscribe(worker: ComputeWorkerSession, handlers: ComputeWorkerHandlers): () => void;
}

export function defaultConcurrency(preferred?: number): number {
  if (typeof preferred === "number" && Number.isFinite(preferred) && preferred >= 1) {
    return Math.min(8, Math.max(1, Math.floor(preferred)));
  }
  const nav = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator;
  const hinted = nav?.hardwareConcurrency;
  if (typeof hinted === "number" && hinted > 0) {
    return Math.min(8, Math.max(1, Math.floor(hinted)));
  }
  return 2;
}
