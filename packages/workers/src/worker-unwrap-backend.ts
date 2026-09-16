import type {
  UvUnwrapBackend,
  UvUnwrapBackendInput,
  UvUnwrapBackendOptions,
  UvUnwrapBackendResult,
} from "@modeling-kit/uv";
import type { AsyncComputePool } from "./pool";

/** Routes xatlas work through an already-initialized compute pool worker. */
export class WorkerPoolUnwrapBackend implements UvUnwrapBackend {
  constructor(private readonly pool: AsyncComputePool) {}

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  unwrap(
    input: UvUnwrapBackendInput,
    options: UvUnwrapBackendOptions,
    signal?: AbortSignal,
  ): Promise<UvUnwrapBackendResult> {
    return this.pool.unwrapUvAsync(input, options, signal);
  }

  dispose(): void {
    // The pool owns worker lifetime.
  }
}
