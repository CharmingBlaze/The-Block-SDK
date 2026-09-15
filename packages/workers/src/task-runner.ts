import { ObjectUrlRegistry } from "@modeling-kit/core";
import { deserializeMesh, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { packUvs, type PackUvsOptions } from "@modeling-kit/uv";
import type { SerializedMesh, TriangulatedMesh } from "@modeling-kit/mesh";
import type { MeshValidationResult } from "@modeling-kit/validation";
import type { WorkerTaskRequest, WorkerTaskResponse } from "./types";

type PendingFinish = (response: WorkerTaskResponse<unknown>) => void;

/**
 * In-process compute pool. Real worker threads can wrap the same request/response
 * types. Generation tokens cancel in-flight work without busy-waiting.
 */
export class AsyncComputePool {
  private taskCounter = 0;
  private generation = 0;
  private disposed = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly pending = new Set<PendingFinish>();
  readonly objectUrls = new ObjectUrlRegistry();

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
        this.pending.delete(finish);
        request.signal?.removeEventListener("abort", onAbort);
        resolve(response as WorkerTaskResponse<T>);
      };
      const onAbort = (): void => {
        finish({ id: request.id, success: false, error: "cancelled" });
      };
      this.pending.add(finish);
      request.signal?.addEventListener("abort", onAbort, { once: true });

      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.disposed || generation !== this.generation || request.signal?.aborted) {
          finish({ id: request.id, success: false, error: "cancelled" });
          return;
        }
        try {
          const task = request.task;
          if (task.type === "triangulate") {
            const mesh = deserializeMesh(task.payload.serializedMesh);
            const tri = triangulateMesh(mesh);
            finish({
              id: request.id,
              success: true,
              result: tri,
            });
          } else if (task.type === "pack-uv") {
            const mesh = deserializeMesh(task.payload.serializedMesh);
            packUvs(mesh, task.payload.options);
            finish({
              id: request.id,
              success: true,
              result: serializeMesh(mesh),
            });
          } else if (task.type === "validate") {
            const mesh = deserializeMesh(task.payload.serializedMesh);
            const result = validateMesh(mesh);
            finish({
              id: request.id,
              success: true,
              result,
            });
          } else {
            finish({
              id: request.id,
              success: false,
              error: "Unknown task type",
            });
          }
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
    for (const finish of [...this.pending]) {
      finish({ id: "disposed", success: false, error: "cancelled" });
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

  private async requireSuccess<T>(promise: Promise<WorkerTaskResponse<T>>): Promise<T> {
    const resp = await promise;
    if (!resp.success) {
      throw new Error(resp.error);
    }
    return resp.result;
  }
}

export const defaultComputePool = new AsyncComputePool();
