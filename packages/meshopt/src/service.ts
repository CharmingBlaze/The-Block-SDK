import type { TriangulatedMesh } from "@modeling-kit/mesh";
import { throwIfAborted } from "./abort";
import { MeshoptJobMachine } from "./job-lifecycle";
import { loadEncoder, loadSimplifier } from "./library";
import { resolveLimits, type MeshoptLimits } from "./limits";
import { optimizeDerived } from "./optimize";
import type { DerivedTriangleBuffers, MeshoptJobResult, MeshoptRequest } from "./types";
import { validateRequest } from "./validate";

export interface RunMeshoptOptions {
  readonly signal?: AbortSignal;
  readonly limits?: Partial<MeshoptLimits>;
}

/**
 * One-shot derived-triangle optimization. Does not cache results.
 * A new {@link MeshoptOptimizer} cancels the previous job when a newer revision is submitted.
 */
export class MeshoptOptimizer {
  private generation = 0;
  private disposed = false;
  private inflight: AbortController | null = null;

  async run(
    request: Omit<MeshoptRequest, "revision">,
    options: RunMeshoptOptions = {},
  ): Promise<MeshoptJobResult> {
    if (this.disposed) {
      return { ok: false, error: "optimizer is disposed", code: "disposed" };
    }
    this.inflight?.abort();
    const revision = this.generation + 1;
    this.generation = revision;
    const local = new AbortController();
    this.inflight = local;
    const machine = new MeshoptJobMachine();
    machine.transition("running");
    const onAbort = (): void => {
      machine.transition("cancelling");
    };
    options.signal?.addEventListener("abort", onAbort);
    local.signal.addEventListener("abort", onAbort);
    try {
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      const full: MeshoptRequest = { ...request, revision };
      const limits = resolveLimits(options.limits);
      const invalid = validateRequest(full, limits);
      if (invalid === "limit-exceeded") {
        machine.transition("failed");
        return { ok: false, error: invalid, code: "limit-exceeded" };
      }
      if (invalid) {
        machine.transition("failed");
        return { ok: false, error: invalid, code: "invalid-input" };
      }

      const encoder = await loadEncoder();
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      if (revision !== this.generation) {
        machine.transition("failed");
        return { ok: false, error: "stale revision", code: "stale-revision" };
      }
      const simplifier = await loadSimplifier();
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      if (revision !== this.generation) {
        machine.transition("failed");
        return { ok: false, error: "stale revision", code: "stale-revision" };
      }

      const timed = await withTimeout(
        () =>
          optimizeDerived(full, { encoder, simplifier }, limits),
        limits.timeoutMs,
      );
      if (revision !== this.generation || options.signal?.aborted || local.signal.aborted) {
        machine.transition("failed");
        return { ok: false, error: "cancelled", code: "cancelled" };
      }
      machine.transition("completed");
      return { ok: true, revision, primary: timed.primary, lod: timed.lod };
    } catch (error) {
      machine.transition("failed");
      if (isCancelled(error) || options.signal?.aborted || local.signal.aborted) {
        return { ok: false, error: "cancelled", code: "cancelled" };
      }
      if (error instanceof TimeoutError) {
        return { ok: false, error: "timeout", code: "timeout" };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "backend-failed",
        code: "backend-failed",
      };
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
      if (this.inflight === local) {
        this.inflight = null;
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.inflight?.abort();
    this.inflight = null;
  }
}

export async function optimizeDerivedTriangles(
  buffers: DerivedTriangleBuffers,
  options: {
    readonly mode?: MeshoptRequest["mode"];
    readonly lod?: { readonly ratio: number; readonly targetError?: number };
    readonly optsize?: boolean;
    readonly signal?: AbortSignal;
  } = {},
): Promise<MeshoptJobResult> {
  const optimizer = new MeshoptOptimizer();
  try {
    const mode = options.lod ? "simplify" : (options.mode ?? "reorder");
    return await optimizer.run(
      {
        ...buffers,
        mode,
        ...(options.optsize !== undefined ? { optsize: options.optsize } : {}),
        ...(options.lod
          ? { targetIndexRatio: options.lod.ratio, targetError: options.lod.targetError }
          : {}),
      },
      { ...(options.signal ? { signal: options.signal } : {}) },
    );
  } finally {
    optimizer.dispose();
  }
}

export function derivedFromTriangulated(mesh: TriangulatedMesh): DerivedTriangleBuffers {
  return {
    positions: mesh.positions,
    indices: mesh.indices,
    normals: mesh.normals,
    uvs: mesh.uvs,
    triangleFaceIds: mesh.triangleFaceIds,
    vertexIdMap: mesh.vertexIdMap,
    cornerIdMap: mesh.cornerIdMap,
  };
}

class TimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

function isCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === "cancelled";
}

async function withTimeout<T>(work: () => T, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
