import { Worker } from "node:worker_threads";
import { defaultConcurrency, type ComputeWorkerBackend, type ComputeWorkerHandlers, type ComputeWorkerSession } from "./backend";

export interface NodeWorkerBackendOptions {
  readonly concurrency?: number;
  readonly workerUrl?: URL;
}

const NODE_WORKER_FILE = "./node-worker.js";

export function nodeWorkerUrl(): URL {
  return new URL(NODE_WORKER_FILE, import.meta.url);
}

export function createNodeWorkerBackend(options: NodeWorkerBackendOptions = {}): ComputeWorkerBackend {
  const url = options.workerUrl ?? nodeWorkerUrl();
  const natives = new WeakMap<ComputeWorkerSession, Worker>();
  return {
    kind: "worker-threads",
    concurrency: defaultConcurrency(options.concurrency),
    spawn(): ComputeWorkerSession {
      const native = new Worker(url);
      const session: ComputeWorkerSession = {
        postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void {
          native.postMessage(message, transfer ? [...transfer] : []);
        },
        terminate(): void {
          void native.terminate();
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
      const onMessage = (data: unknown): void => {
        handlers.onMessage(data);
      };
      const onError = (error: unknown): void => {
        handlers.onError(error);
      };
      const onExit = (code: number): void => {
        handlers.onExit?.(code);
      };
      native.on("message", onMessage);
      native.on("error", onError);
      native.on("exit", onExit);
      return () => {
        native.off("message", onMessage);
        native.off("error", onError);
        native.off("exit", onExit);
      };
    },
  };
}
