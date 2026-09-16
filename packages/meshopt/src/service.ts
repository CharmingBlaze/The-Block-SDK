import { throwIfAborted } from "./abort";
import { MeshoptJob } from "./job";
import { loadEncoder, loadSimplifier } from "./library";
import { resolveLimits, type MeshoptLimits } from "./limits";
import { optimizeDerived } from "./optimize";
import { TimeoutError, withTimeout } from "./timeout";
import type { DerivedTriangleBuffers, MeshoptFailure, MeshoptJobResult, MeshoptRequest } from "./types";
import { validateRequest } from "./validate";

export interface RunMeshoptOptions {
  readonly signal?: AbortSignal;
  readonly limits?: Partial<MeshoptLimits>;
}

/**
 * One-shot derived-triangle optimization. Does not cache results.
 * Submitting a newer revision cancels the previous job on this instance.
 */
export class MeshoptOptimizer {
  private generation = 0;
  private disposed = false;
  private inflight: AbortController | null = null;
  private job: MeshoptJob | null = null;

  async run(
    request: Omit<MeshoptRequest, "revision">,
    options: RunMeshoptOptions = {},
  ): Promise<MeshoptJobResult> {
    if (this.disposed) {
      return { ok: false, error: "optimizer is disposed", code: "disposed" };
    }
    this.inflight?.abort();
    this.job?.cancel();
    const revision = this.generation + 1;
    this.generation = revision;
    const local = new AbortController();
    this.inflight = local;
    const job = new MeshoptJob(`meshopt-${revision}`);
    this.job = job;
    job.start();
    const onAbort = (): void => {
      job.cancel();
    };
    options.signal?.addEventListener("abort", onAbort);
    local.signal.addEventListener("abort", onAbort);
    try {
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      const full: MeshoptRequest = { ...request, revision };
      const limits = resolveLimits(options.limits);
      const invalid = validateRequest(full, limits);
      if (invalid) {
        return fail(job, invalid === "limit-exceeded" ? "limit-exceeded" : "invalid-input", invalid);
      }

      const encoder = await loadEncoder();
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      if (revision !== this.generation) {
        return fail(job, "stale-revision", "stale revision");
      }
      const simplifier = await loadSimplifier();
      throwIfAborted(options.signal);
      throwIfAborted(local.signal);
      if (revision !== this.generation) {
        return fail(job, "stale-revision", "stale revision");
      }

      const timed = await withTimeout(
        () => optimizeDerived(full, { encoder, simplifier }, limits),
        limits.timeoutMs,
      );
      if (revision !== this.generation) {
        return fail(job, "stale-revision", "stale revision");
      }
      if (options.signal?.aborted || local.signal.aborted || job.cancelled) {
        return fail(job, "cancelled", "cancelled");
      }
      const success = { ok: true as const, revision, primary: timed.primary, lod: timed.lod };
      job.complete(success);
      return success;
    } catch (error) {
      if (isCancelled(error) || options.signal?.aborted || local.signal.aborted) {
        return fail(job, "cancelled", "cancelled");
      }
      if (error instanceof TimeoutError) {
        return fail(job, "timeout", "timeout");
      }
      return fail(job, "backend-failed", error instanceof Error ? error.message : "backend-failed");
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
    this.job?.dispose();
    this.job = null;
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

export function derivedFromTriangulated(mesh: DerivedTriangleBuffers): DerivedTriangleBuffers {
  return mesh;
}

function fail(job: MeshoptJob, code: MeshoptFailure["code"], error: string): MeshoptFailure {
  const result: MeshoptFailure = { ok: false, error, code };
  job.complete(result);
  return result;
}

function isCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === "cancelled";
}
