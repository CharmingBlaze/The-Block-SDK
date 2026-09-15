import { ObjectUrlRegistry } from "@modeling-kit/core";
import type { SerializedMesh, TriangulatedMesh } from "@modeling-kit/mesh";
import type { PackUvsOptions } from "@modeling-kit/uv";
import type { MeshValidationResult } from "@modeling-kit/validation";
import { runComputeTask } from "./compute-task";
import type { WorkerTaskRequest, WorkerTaskResponse } from "./types";

type PendingFinish = (response: WorkerTaskResponse<unknown>) => void;

interface InFlight {
  readonly id: string;
  readonly finish: PendingFinish;
  worker?: WorkerLike;
}

interface WorkerLike {
  postMessage(value: unknown): void;
  terminate(): Promise<number> | number | void;
  on(event: "message" | "error" | "exit", listener: (...args: unknown[]) => void): void;
}

export type ComputeBackend = "worker-threads" | "inline";

/**
 * Background compute pool. Prefers Node `worker_threads` so heavy triangulation
 * can be interrupted with `terminate()`. Falls back to cooperative inline work
 * with abort checkpoints inside `triangulateMesh`.
 */
export class AsyncComputePool {
  private taskCounter = 0;
  private generation = 0;
  private disposed = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly pending = new Set<InFlight>();
  readonly objectUrls = new ObjectUrlRegistry();
  readonly backend: ComputeBackend;

  constructor(options: { backend?: ComputeBackend } = {}) {
    this.backend = options.backend ?? detectBackend();
  }

  async dispatch<T>(request: WorkerTaskRequest): Promise<WorkerTaskResponse<T>> {
    const generation = this.generation;
    if (this.disposed || request.signal?.aborted) {
      return { id: request.id, success: false, error: "cancelled" };
    }

    if (this.backend === "worker-threads") {
      return this.dispatchOnWorker<T>(request, generation);
    }
    return this.dispatchInline<T>(request, generation);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.generation += 1;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const item of [...this.pending]) {
      void item.worker?.terminate();
      item.finish({ id: item.id, success: false, error: "cancelled" });
    }
    this.pending.clear();
    this.objectUrls.dispose();
  }

  async triangulateAsync(mesh: SerializedMesh, signal?: AbortSignal): Promise<TriangulatedMesh> {
    return this.requireSuccess(
      this.dispatch<TriangulatedMesh>({
        id: `task-${++this.taskCounter}`,
        task: { type: "triangulate", payload: { serializedMesh: mesh } },
        ...(signal ? { signal } : {}),
      }),
    );
  }

  async packUvsAsync(
    mesh: SerializedMesh,
    options?: PackUvsOptions,
    signal?: AbortSignal,
  ): Promise<SerializedMesh> {
    return this.requireSuccess(
      this.dispatch<SerializedMesh>({
        id: `task-${++this.taskCounter}`,
        task: { type: "pack-uv", payload: { serializedMesh: mesh, options } },
        ...(signal ? { signal } : {}),
      }),
    );
  }

  async validateAsync(mesh: SerializedMesh, signal?: AbortSignal): Promise<MeshValidationResult> {
    return this.requireSuccess(
      this.dispatch<MeshValidationResult>({
        id: `task-${++this.taskCounter}`,
        task: { type: "validate", payload: { serializedMesh: mesh } },
        ...(signal ? { signal } : {}),
      }),
    );
  }

  private async dispatchOnWorker<T>(
    request: WorkerTaskRequest,
    generation: number,
  ): Promise<WorkerTaskResponse<T>> {
    try {
      const { Worker } = await import("node:worker_threads");
      const worker = new Worker(resolveWorkerUrl()) as unknown as WorkerLike;
      return await new Promise<WorkerTaskResponse<T>>((resolve) => {
        let settled = false;
        const finish: PendingFinish = (response) => {
          if (settled) {
            return;
          }
          settled = true;
          request.signal?.removeEventListener("abort", onAbort);
          this.pending.delete(item);
          void worker.terminate();
          resolve(response as WorkerTaskResponse<T>);
        };
        const item: InFlight = { id: request.id, finish, worker };
        const onAbort = (): void => {
          void worker.terminate();
          finish({ id: request.id, success: false, error: "cancelled" });
        };
        this.pending.add(item);
        request.signal?.addEventListener("abort", onAbort, { once: true });
        worker.on("message", (message) => {
          finish(message as WorkerTaskResponse<unknown>);
        });
        worker.on("error", (err) => {
          if (generation !== this.generation || this.disposed || request.signal?.aborted) {
            finish({ id: request.id, success: false, error: "cancelled" });
            return;
          }
          try {
            const result = runComputeTask(request.task, request.signal);
            finish({ id: request.id, success: true, result });
          } catch (fallbackErr) {
            finish({
              id: request.id,
              success: false,
              error:
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : err instanceof Error
                    ? err.message
                    : String(fallbackErr),
            });
          }
        });
        worker.on("exit", (code) => {
          if (settled) {
            return;
          }
          finish({
            id: request.id,
            success: false,
            error: code === 1 ? "cancelled" : `Worker exited with code ${String(code)}`,
          });
        });
        worker.postMessage({ id: request.id, task: request.task });
      });
    } catch {
      return this.dispatchInline<T>(request, generation);
    }
  }

  private async dispatchInline<T>(
    request: WorkerTaskRequest,
    generation: number,
  ): Promise<WorkerTaskResponse<T>> {
    return new Promise((resolve) => {
      let settled = false;
      const finish: PendingFinish = (response) => {
        if (settled) {
          return;
        }
        settled = true;
        this.pending.delete(item);
        request.signal?.removeEventListener("abort", onAbort);
        resolve(response as WorkerTaskResponse<T>);
      };
      const item: InFlight = { id: request.id, finish };
      const onAbort = (): void => {
        finish({ id: request.id, success: false, error: "cancelled" });
      };
      this.pending.add(item);
      request.signal?.addEventListener("abort", onAbort, { once: true });

      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.disposed || generation !== this.generation || request.signal?.aborted) {
          finish({ id: request.id, success: false, error: "cancelled" });
          return;
        }
        try {
          const result = runComputeTask(request.task, request.signal);
          finish({ id: request.id, success: true, result });
        } catch (err) {
          finish({
            id: request.id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, 0);
      this.timers.add(timer);
    });
  }

  private async requireSuccess<T>(promise: Promise<WorkerTaskResponse<T>>): Promise<T> {
    const resp = await promise;
    if (!resp.success) {
      throw new Error(resp.error);
    }
    return resp.result;
  }
}

function detectBackend(): ComputeBackend {
  if (typeof process === "undefined" || !process.versions?.node) {
    return "inline";
  }
  return resolveWorkerUrl().href.endsWith(".js") ? "worker-threads" : "inline";
}

function resolveWorkerUrl(): URL {
  const inDist = /[/\\]dist[/\\]/.test(import.meta.url);
  return new URL(inDist ? "./node-worker.js" : "./node-worker.ts", import.meta.url);
}

export const defaultComputePool = new AsyncComputePool({ backend: "inline" });
