import { defaultConcurrency, type ComputeWorkerBackend, type ComputeWorkerHandlers, type ComputeWorkerSession } from "./backend";

export interface BrowserWorkerLike {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
  terminate(): void;
  addEventListener(type: "message" | "error", listener: (event: BrowserWorkerEvent) => void): void;
  removeEventListener(type: "message" | "error", listener: (event: BrowserWorkerEvent) => void): void;
}

export interface BrowserWorkerEvent {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly message?: string;
}

export interface BrowserWorkerConstructor {
  new (scriptURL: URL, options: { type: "module" }): BrowserWorkerLike;
}

export interface BrowserWorkerBackendOptions {
  readonly concurrency?: number;
  readonly workerUrl?: URL;
  readonly WorkerImpl?: BrowserWorkerConstructor;
}

const BROWSER_WORKER_FILE = "./browser-worker.js";

export function browserWorkerUrl(): URL {
  return new URL(BROWSER_WORKER_FILE, import.meta.url);
}

export function createBrowserWorkerBackend(options: BrowserWorkerBackendOptions = {}): ComputeWorkerBackend {
  const WorkerImpl = options.WorkerImpl ?? getGlobalWorker();
  if (!WorkerImpl) {
    throw new Error("Browser Worker is not available in this runtime");
  }
  const url = options.workerUrl ?? browserWorkerUrl();
  const natives = new WeakMap<ComputeWorkerSession, BrowserWorkerLike>();
  return {
    kind: "browser-worker",
    concurrency: defaultConcurrency(options.concurrency),
    spawn(): ComputeWorkerSession {
      const native = new WorkerImpl(url, { type: "module" });
      const session: ComputeWorkerSession = {
        postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void {
          native.postMessage(message, transfer ? [...transfer] : []);
        },
        terminate(): void {
          native.terminate();
        },
      };
      natives.set(session, native);
      return session;
    },
    subscribe(worker: ComputeWorkerSession, handlers: ComputeWorkerHandlers): () => void {
      const native = natives.get(worker);
      if (!native) {
        return () => undefined;
      }
      const onMessage = (event: BrowserWorkerEvent): void => {
        handlers.onMessage(event.data);
      };
      const onError = (event: BrowserWorkerEvent): void => {
        handlers.onError(event.error ?? event.message ?? "Worker error");
      };
      native.addEventListener("message", onMessage);
      native.addEventListener("error", onError);
      return () => {
        native.removeEventListener("message", onMessage);
        native.removeEventListener("error", onError);
      };
    },
  };
}

function getGlobalWorker(): BrowserWorkerConstructor | undefined {
  const candidate = (globalThis as { Worker?: BrowserWorkerConstructor }).Worker;
  return typeof candidate === "function" ? candidate : undefined;
}
