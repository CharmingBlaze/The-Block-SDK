import { describe, expect, it } from "vitest";
import { MeshBuilder, serializeMesh } from "@modeling-kit/mesh";
import {
  AsyncComputePool,
  createBrowserComputePool,
  type BrowserWorkerConstructor,
  type BrowserWorkerEvent,
  type BrowserWorkerLike,
} from "../src/browser";
import { runComputeTask } from "../src/compute-task";
import type { TaskPayload } from "../src/types";

class FakeWorker implements BrowserWorkerLike {
  static running = 0;
  static created = 0;
  static lastOptions: { type: "module" } | undefined;
  static lastUrl: URL | undefined;
  delayMs = 20;
  crash = false;
  terminated = false;
  private readonly messageListeners: Array<(event: BrowserWorkerEvent) => void> = [];
  private readonly errorListeners: Array<(event: BrowserWorkerEvent) => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(scriptURL: URL, options: { type: "module" }) {
    FakeWorker.created += 1;
    FakeWorker.lastUrl = scriptURL;
    FakeWorker.lastOptions = options;
  }

  addEventListener(type: "message" | "error", listener: (event: BrowserWorkerEvent) => void): void {
    if (type === "message") {
      this.messageListeners.push(listener);
      return;
    }
    this.errorListeners.push(listener);
  }

  removeEventListener(type: "message" | "error", listener: (event: BrowserWorkerEvent) => void): void {
    const list = type === "message" ? this.messageListeners : this.errorListeners;
    const index = list.indexOf(listener);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  postMessage(message: unknown): void {
    const payload = message as { id: string; task: TaskPayload };
    FakeWorker.running += 1;
    this.timer = setTimeout(() => {
      void this.finishTask(payload);
    }, this.delayMs);
    this.timer.unref?.();
  }

  private async finishTask(payload: { id: string; task: TaskPayload }): Promise<void> {
    this.timer = undefined;
    FakeWorker.running -= 1;
    if (this.terminated) {
      return;
    }
    if (this.crash) {
      for (const listener of this.errorListeners) {
        listener({ message: "boom" });
      }
      return;
    }
    try {
      const result = await runComputeTask(payload.task);
      if (this.terminated) {
        return;
      }
      for (const listener of this.messageListeners) {
        listener({ data: { id: payload.id, success: true, result } });
      }
    } catch (err) {
      for (const listener of this.errorListeners) {
        listener({ error: err });
      }
    }
  }

  terminate(): void {
    this.terminated = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      FakeWorker.running -= 1;
    }
  }
}

function cubeMesh() {
  return serializeMesh(MeshBuilder.createCube(2, 2, 2));
}

const fakeWorkerUrl = new URL("https://workers.test/browser-worker.js");

function poolOptions(WorkerImpl: BrowserWorkerConstructor, concurrency: number) {
  return {
    WorkerImpl,
    concurrency,
    workerUrl: fakeWorkerUrl,
  };
}

describe("@modeling-kit/workers/browser", () => {
  it("constructs module workers", async () => {
    FakeWorker.created = 0;
    const pool = createBrowserComputePool(poolOptions(FakeWorker as unknown as BrowserWorkerConstructor, 1));
    expect(pool.backend).toBe("browser-worker");
    const tri = await pool.triangulateAsync(cubeMesh());
    expect(tri.indices.length).toBe(12 * 3);
    expect(FakeWorker.created).toBe(1);
    expect(FakeWorker.lastOptions).toEqual({ type: "module" });
    expect(FakeWorker.lastUrl?.href).toBe(fakeWorkerUrl.href);
    pool.dispose();
  });

  it("cancels an in-flight browser worker without waiting for completion", async () => {
    const pool = new AsyncComputePool(poolOptions(FakeWorker as unknown as BrowserWorkerConstructor, 1));
    const controller = new AbortController();
    const pending = pool.triangulateAsync(cubeMesh(), controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(FakeWorker.running).toBe(0);
    pool.dispose();
  });

  it("queues work beyond the concurrency bound", async () => {
    FakeWorker.running = 0;
    let peak = 0;
    const WorkerImpl = class extends FakeWorker {
      override postMessage(message: unknown): void {
        super.postMessage(message);
        peak = Math.max(peak, FakeWorker.running);
      }
    };
    const pool = createBrowserComputePool(poolOptions(WorkerImpl as unknown as BrowserWorkerConstructor, 2));
    const serialized = cubeMesh();
    await Promise.all([
      pool.validateAsync(serialized),
      pool.validateAsync(serialized),
      pool.validateAsync(serialized),
      pool.validateAsync(serialized),
    ]);
    expect(peak).toBe(2);
    pool.dispose();
  });

  it("replaces a crashed browser worker and continues", async () => {
    let spawned = 0;
    const WorkerImpl = class extends FakeWorker {
      constructor(scriptURL: URL, options: { type: "module" }) {
        super(scriptURL, options);
        spawned += 1;
        this.crash = spawned === 1;
        this.delayMs = 5;
      }
    };
    const pool = createBrowserComputePool(poolOptions(WorkerImpl as unknown as BrowserWorkerConstructor, 1));
    const serialized = cubeMesh();
    await expect(pool.validateAsync(serialized)).rejects.toThrow(/boom/);
    const result = await pool.validateAsync(serialized);
    expect(result.valid).toBe(true);
    expect(spawned).toBeGreaterThanOrEqual(2);
    pool.dispose();
  });

  it("charts a cube through the browser worker unwrap-uv task", async () => {
    const pool = createBrowserComputePool(poolOptions(FakeWorker as unknown as BrowserWorkerConstructor, 1));
    const positions = new Float32Array([
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
    ]);
    const indices = new Uint32Array([
      0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0, 1, 5, 6, 1, 6, 2, 4, 0, 3, 4, 3, 7,
    ]);
    try {
      const result = await pool.unwrapUvAsync({ positions, indices }, { resolution: 64, padding: 1 });
      expect(result.triangleCount).toBe(12);
      expect(result.atlasWidth).toBeGreaterThan(0);
    } finally {
      pool.dispose();
    }
  });
});
