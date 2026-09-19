# @modeling-kit/workers

**Compute worker pool for off-thread processing.** Runs expensive operations (UV unwrap, triangulation, packing, validation) in browser Web Workers or Node.js worker threads.

## Purpose

The `workers` package provides:

- **AsyncComputePool** — manages a pool of workers with task queuing, cancellation, and timeout handling
- **Multiple backends** — inline (same thread), browser (Web Workers), and Node.js (worker_threads)
- **Task types** — triangulation, UV packing, UV unwrap (xatlas), mesh validation
- **Transfer optimization** — binary data is transferred via `postMessage` transfer lists (zero-copy)
- **Stale result detection** — results are validated against revision counters to prevent applying obsolete data

## Key Exports

```ts
// Pool
import {
  AsyncComputePool, createInlineComputePool,
  type AsyncComputePoolOptions,
} from "@modeling-kit/workers";

// Backend types
import { type ComputeBackend } from "@modeling-kit/workers";

// Task runner
import { runComputeTask } from "@modeling-kit/workers";

// Unwrap backend
import { WorkerPoolUnwrapBackend } from "@modeling-kit/workers";

// Task types
import type {
  TaskPayload, TaskType,
  TriangulateTaskPayload, PackUvsTaskPayload,
  UnwrapUvTaskPayload, ValidateTaskPayload,
  WorkerTaskRequest, WorkerTaskResponse,
  WorkerTaskSuccessResponse, WorkerTaskErrorResponse,
} from "@modeling-kit/workers";
```

## Usage Example

```ts
import { AsyncComputePool } from "@modeling-kit/workers";

// Create a pool (automatically detects browser/Node)
const pool = new AsyncComputePool({
  maxWorkers: navigator.hardwareConcurrency - 1, // leave one core free
  taskTimeout: 30000, // 30 second timeout
});

// Submit a task
const task = await pool.submit({
  type: "unwrap-uv",
  meshId: "mesh-1",
  channel: "default",
  // ... task-specific options
});

// Await result
const result = await task.promise;

// Dispose when done
pool.dispose();
```

```ts
// Inline backend (no workers — for testing/SSR)
import { createInlineComputePool } from "@modeling-kit/workers";

const pool = createInlineComputePool();
// Tasks run synchronously on the main thread
```

## Architecture Notes

- `AsyncComputePool` automatically selects the correct backend: browser Web Workers in the DOM, Node.js `worker_threads` on the server.
- Workers are **shared across the application** — pool instances are typically singletons.
- Binary data (typed arrays) is transferred via `postMessage` **transfer lists**, avoiding copy overhead.
- `StaleJobCheck` ensures that if the mesh was edited while the worker was running, the stale result is discarded.
- `WorkerPoolUnwrapBackend` plugs the worker pool into `@modeling-kit/uv`'s automatic unwrap system.
- See `docs/guides/workers.md` for configuration and browser compatibility.