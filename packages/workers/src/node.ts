import { createNodeWorkerBackend, type NodeWorkerBackendOptions } from "./node-backend";
import { AsyncComputePool as CoreAsyncComputePool, type AsyncComputePoolOptions } from "./pool";

export type { ComputeBackend } from "./backend";
export { createInlineComputePool, type AsyncComputePoolOptions } from "./pool";
export type {
  TaskPayload,
  TaskType,
  TriangulateTaskPayload,
  PackUvsTaskPayload,
  UnwrapUvTaskPayload,
  ValidateTaskPayload,
  WorkerTaskRequest,
  WorkerTaskResponse,
  WorkerTaskSuccessResponse,
  WorkerTaskErrorResponse,
} from "./types";
export { runComputeTask } from "./compute-task";
export { WorkerPoolUnwrapBackend } from "./worker-unwrap-backend";
export { createNodeWorkerBackend, nodeWorkerUrl, type NodeWorkerBackendOptions } from "./node-backend";

/** `new AsyncComputePool()` from this entry uses `worker_threads`. Pass `backend: "inline"` to opt out. */
export class AsyncComputePool extends CoreAsyncComputePool {
  constructor(options: AsyncComputePoolOptions & NodeWorkerBackendOptions = {}) {
    if (options.backend === "inline" || options.adapter) {
      super(options);
      return;
    }
    super({ ...options, adapter: createNodeWorkerBackend(options) });
  }
}

export function createNodeComputePool(
  options: AsyncComputePoolOptions & NodeWorkerBackendOptions = {},
): AsyncComputePool {
  return new AsyncComputePool(options);
}
