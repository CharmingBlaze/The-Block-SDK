import { createBrowserWorkerBackend, type BrowserWorkerBackendOptions } from "./browser-backend";
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
export { WorkerPoolUnwrapBackend } from "./worker-unwrap-backend";
export {
  createBrowserWorkerBackend,
  browserWorkerUrl,
  type BrowserWorkerBackendOptions,
  type BrowserWorkerConstructor,
  type BrowserWorkerEvent,
  type BrowserWorkerLike,
} from "./browser-backend";

/** `new AsyncComputePool()` from this entry uses a browser `Worker`. Pass `backend: "inline"` to opt out. */
export class AsyncComputePool extends CoreAsyncComputePool {
  constructor(options: AsyncComputePoolOptions & BrowserWorkerBackendOptions = {}) {
    if (options.backend === "inline" || options.adapter) {
      super(options);
      return;
    }
    super({ ...options, adapter: createBrowserWorkerBackend(options) });
  }
}

export function createBrowserComputePool(
  options: AsyncComputePoolOptions & BrowserWorkerBackendOptions = {},
): AsyncComputePool {
  return new AsyncComputePool(options);
}
