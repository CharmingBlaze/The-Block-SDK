import type { SerializedMesh, TriangulatedMesh } from "@modeling-kit/mesh";
import type { PackUvsOptions } from "@modeling-kit/uv";
import type { MeshValidationResult } from "@modeling-kit/validation";
import { defaultConcurrency, type ComputeBackend, type ComputeWorkerBackend, type ComputeWorkerSession } from "./backend";
import { createInlineBackend } from "./inline-backend";
import type { WorkerTaskRequest, WorkerTaskResponse } from "./types";

type PendingFinish = (response: WorkerTaskResponse<unknown>) => void;

interface QueuedItem {
  readonly id: string;
  readonly request: WorkerTaskRequest;
  readonly generation: number;
  readonly finish: PendingFinish;
}

export interface AsyncComputePoolOptions {
  readonly backend?: ComputeBackend;
  readonly concurrency?: number;
  readonly adapter?: ComputeWorkerBackend;
}

/**
 * Bounded compute pool. The public entry uses cooperative inline work.
 * Browser and Node entries inject real worker adapters.
 */
export class AsyncComputePool {
  private taskCounter = 0;
  private generation = 0;
  private disposed = false;
  private readonly adapter: ComputeWorkerBackend;
  private readonly concurrency: number;
  private readonly workers = new Set<ComputeWorkerSession>();
  private readonly idle: ComputeWorkerSession[] = [];
  private readonly busy = new Map<ComputeWorkerSession, QueuedItem>();
  private readonly unsubscribes = new Map<ComputeWorkerSession, () => void>();
  private readonly queue: QueuedItem[] = [];
  readonly backend: ComputeBackend;

  constructor(options: AsyncComputePoolOptions = {}) {
    if (options.adapter) {
      this.adapter = options.adapter;
    } else if (options.backend === undefined || options.backend === "inline") {
      this.adapter = createInlineBackend();
    } else {
      throw new Error(
        `Backend "${options.backend}" is not available from @modeling-kit/workers. Import @modeling-kit/workers/browser or @modeling-kit/workers/node.`,
      );
    }
    this.backend = this.adapter.kind;
    this.concurrency = defaultConcurrency(options.concurrency ?? this.adapter.concurrency);
  }

  async dispatch<T>(request: WorkerTaskRequest): Promise<WorkerTaskResponse<T>> {
    const generation = this.generation;
    if (this.disposed || request.signal?.aborted) {
      return { id: request.id, success: false, error: "cancelled" };
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish: PendingFinish = (response) => {
        if (settled) {
          return;
        }
        settled = true;
        request.signal?.removeEventListener("abort", onAbort);
        resolve(response as WorkerTaskResponse<T>);
      };
      const item: QueuedItem = { id: request.id, request, generation, finish };
      const onAbort = (): void => {
        this.cancelItem(item, "cancelled");
      };
      request.signal?.addEventListener("abort", onAbort, { once: true });
      this.queue.push(item);
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.generation += 1;
    const queued = this.queue.splice(0, this.queue.length);
    for (const item of queued) {
      item.finish({ id: item.id, success: false, error: "cancelled" });
    }
    for (const worker of [...this.workers]) {
      const item = this.busy.get(worker);
      this.retireWorker(worker);
      item?.finish({ id: item.id, success: false, error: "cancelled" });
    }
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

  private pump(): void {
    if (this.disposed) {
      return;
    }
    while (this.queue.length > 0 && this.busy.size < this.concurrency) {
      const worker = this.takeWorker();
      if (!worker) {
        break;
      }
      const item = this.queue.shift();
      if (!item) {
        this.idle.push(worker);
        break;
      }
      if (item.generation !== this.generation || this.disposed || item.request.signal?.aborted) {
        this.idle.push(worker);
        item.finish({ id: item.id, success: false, error: "cancelled" });
        continue;
      }
      this.startOnWorker(worker, item);
    }
  }

  private takeWorker(): ComputeWorkerSession | undefined {
    const idle = this.idle.pop();
    if (idle) {
      return idle;
    }
    if (this.workers.size >= this.concurrency) {
      return undefined;
    }
    return this.spawnWorker();
  }

  private spawnWorker(): ComputeWorkerSession {
    const worker = this.adapter.spawn();
    const unsubscribe = this.adapter.subscribe(worker, {
      onMessage: (data) => {
        this.onWorkerMessage(worker, data);
      },
      onError: (error) => {
        this.onWorkerCrash(worker, error);
      },
      onExit: (code) => {
        this.onWorkerExit(worker, code);
      },
    });
    this.workers.add(worker);
    this.unsubscribes.set(worker, unsubscribe);
    return worker;
  }

  private startOnWorker(worker: ComputeWorkerSession, item: QueuedItem): void {
    this.busy.set(worker, item);
    const message = { id: item.id, task: item.request.task };
    worker.postMessage(message);
  }

  private onWorkerMessage(worker: ComputeWorkerSession, data: unknown): void {
    const item = this.busy.get(worker);
    if (!item) {
      return;
    }
    const response = data as WorkerTaskResponse<unknown>;
    if (response.id !== item.id) {
      return;
    }
    this.busy.delete(worker);
    if (this.adapter.kind === "inline") {
      this.retireWorker(worker);
    } else if (!this.disposed) {
      this.idle.push(worker);
    }
    if (item.generation !== this.generation || this.disposed || item.request.signal?.aborted) {
      item.finish({ id: item.id, success: false, error: "cancelled" });
    } else {
      item.finish(response);
    }
    this.pump();
  }

  private onWorkerCrash(worker: ComputeWorkerSession, error: unknown): void {
    const item = this.busy.get(worker);
    this.retireWorker(worker);
    if (item) {
      const cancelled = item.generation !== this.generation || this.disposed || item.request.signal?.aborted;
      item.finish({
        id: item.id,
        success: false,
        error: cancelled ? "cancelled" : error instanceof Error ? error.message : String(error),
      });
    }
    this.pump();
  }

  private onWorkerExit(worker: ComputeWorkerSession, code?: number): void {
    const item = this.busy.get(worker);
    if (!item) {
      if (!this.workers.has(worker)) {
        return;
      }
      this.retireWorker(worker);
      this.pump();
      return;
    }
    this.retireWorker(worker);
    item.finish({
      id: item.id,
      success: false,
      error: code === 1 || this.disposed || item.request.signal?.aborted
        ? "cancelled"
        : `Worker exited with code ${String(code ?? "unknown")}`,
    });
    this.pump();
  }

  private cancelItem(item: QueuedItem, error: string): void {
    const queuedIndex = this.queue.indexOf(item);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      item.finish({ id: item.id, success: false, error });
      return;
    }
    for (const [worker, busyItem] of this.busy) {
      if (busyItem !== item) {
        continue;
      }
      this.retireWorker(worker);
      item.finish({ id: item.id, success: false, error });
      this.pump();
      return;
    }
  }

  private retireWorker(worker: ComputeWorkerSession): void {
    this.busy.delete(worker);
    const idleIndex = this.idle.indexOf(worker);
    if (idleIndex >= 0) {
      this.idle.splice(idleIndex, 1);
    }
    this.workers.delete(worker);
    const unsubscribe = this.unsubscribes.get(worker);
    this.unsubscribes.delete(worker);
    unsubscribe?.();
    worker.terminate();
  }

  private async requireSuccess<T>(promise: Promise<WorkerTaskResponse<T>>): Promise<T> {
    const resp = await promise;
    if (!resp.success) {
      throw new Error(resp.error);
    }
    return resp.result;
  }
}

export function createInlineComputePool(
  options: Omit<AsyncComputePoolOptions, "adapter" | "backend"> = {},
): AsyncComputePool {
  return new AsyncComputePool({ ...options, backend: "inline" });
}

