import {
  resolvePickPolicy,
  type IdentityPickResult,
  type PointPickRequest,
  type PointPickResult,
  type PointPickSource,
  type SurfacePickResult,
} from "@modeling-kit/selection";
import {
  asWebGLRenderer,
  clientToViewportPixel,
  defaultViewportRect,
  drawingBufferSize,
  type DefaultGpuPickingService,
  type GpuPickingReadback,
} from "./gpu-picking";
import { gpuIdentityFromHit } from "./gpu-picking/gpu-result-adapter";
import { clientToNdc } from "./pick-selection";
import type { PickResult, PickingOptions } from "./picking";
import type { ViewportRenderer } from "./adapter-types";

export type PickFailureReason =
  | "miss"
  | "unavailable"
  | "id-overflow"
  | "refinement-failed"
  | "stale-session";

export interface HybridPickContext {
  gpuPickingMode: GpuPickingReadback | "off";
  gpuPicking: DefaultGpuPickingService | undefined;
  renderer: ViewportRenderer;
  viewport: { width: number; height: number; pixelRatio: number };
  lastPickSource: PointPickSource | "unavailable";
  lastPickFailure?: PickFailureReason | undefined;
  pick: (ndcX: number, ndcY: number, options?: Partial<PickingOptions>) => PickResult | null;
  refineIdentity?: (identity: IdentityPickResult, request: PointPickRequest) => SurfacePickResult | undefined;
}

function identityFromCpu(hit: PickResult): IdentityPickResult {
  return {
    kind: "identity",
    source: "cpu-raycast",
    domain: hit.domain,
    objectId: hit.objectId,
    ...(hit.meshId ? { meshId: hit.meshId } : {}),
    ...(hit.faceId ? { faceId: hit.faceId } : {}),
    ...(hit.vertexId ? { vertexId: hit.vertexId } : {}),
    ...(hit.edgeId ? { edgeId: hit.edgeId } : {}),
    ...(hit.triangleIndex !== undefined ? { triangleIndex: hit.triangleIndex } : {}),
  };
}

export async function pickPointHybrid(
  context: HybridPickContext,
  request: PointPickRequest,
): Promise<PointPickResult | undefined> {
  const policy = resolvePickPolicy(request);
  const viewport = request.viewport ?? defaultViewportRect(request.canvasRect);
  const ndcRect = {
    left: request.canvasRect.left + viewport.x,
    top: request.canvasRect.top + viewport.y,
    width: viewport.width,
    height: viewport.height,
  };
  if (
    request.clientX < ndcRect.left ||
    request.clientY < ndcRect.top ||
    request.clientX >= ndcRect.left + ndcRect.width ||
    request.clientY >= ndcRect.top + ndcRect.height
  ) {
    context.lastPickSource = "unavailable";
    context.lastPickFailure = "unavailable";
    return undefined;
  }

  const useGpu =
    policy.backend === "gpu-id-buffer" &&
    context.gpuPickingMode !== "off" &&
    context.gpuPicking !== undefined &&
    context.gpuPicking.diagnostics().backend !== "unavailable";

  if (useGpu && context.gpuPicking) {
    const webgl = asWebGLRenderer(context.renderer);
    const buffer = drawingBufferSize(
      webgl,
      context.viewport.width,
      context.viewport.height,
      context.viewport.pixelRatio,
    );
    const pixel = clientToViewportPixel(
      request.clientX,
      request.clientY,
      request.canvasRect,
      viewport,
      buffer.x,
      buffer.y,
    );
    if (!pixel) {
      context.lastPickSource = "unavailable";
      context.lastPickFailure = "unavailable";
      return undefined;
    }
    const gpu = await context.gpuPicking.pick({
      pixelX: pixel.x,
      pixelY: pixel.y,
      viewportWidth: Math.max(1, Math.round(viewport.width * (buffer.x / request.canvasRect.width))),
      viewportHeight: Math.max(1, Math.round(viewport.height * (buffer.y / request.canvasRect.height))),
      domain: request.domain === "face" ? "face" : "object",
      backfaceMode: policy.backfaceMode,
    });
    if (context.gpuPicking.diagnostics().idOverflow) {
      context.lastPickFailure = "id-overflow";
      if (!policy.allowCpuFallbackOnOverflow) {
        context.lastPickSource = "unavailable";
        return undefined;
      }
    } else {
      context.lastPickSource = "gpu-id-buffer";
      if (!gpu) {
        context.lastPickFailure = "miss";
        return undefined;
      }
      const identity = gpuIdentityFromHit(gpu, request.domain);
      if (!policy.requireSurfacePoint) {
        context.lastPickFailure = undefined;
        return identity;
      }
      const surface = context.refineIdentity?.(identity, request);
      if (surface) {
        context.lastPickSource = "gpu-plus-cpu-refinement";
        context.lastPickFailure = undefined;
        return surface;
      }
      context.lastPickFailure = "refinement-failed";
      if (!policy.allowCpuFallbackOnRefinementFailure) {
        return undefined;
      }
    }
  }

  const ndc = clientToNdc(request.clientX, request.clientY, ndcRect);
  const hit = context.pick(ndc.x, ndc.y, {
    domain: request.domain,
    frontFacingOnly: policy.backfaceMode === "front-only",
  });
  context.lastPickSource = hit ? "cpu-raycast" : "unavailable";
  if (!hit) {
    context.lastPickFailure = context.lastPickFailure ?? "miss";
    return undefined;
  }
  if (policy.requireSurfacePoint && hit.meshId && hit.faceId) {
    const identity: IdentityPickResult = {
      kind: "identity",
      source: "cpu-raycast",
      domain: hit.domain,
      objectId: hit.objectId,
      meshId: hit.meshId,
      faceId: hit.faceId,
      ...(hit.triangleIndex !== undefined ? { triangleIndex: hit.triangleIndex } : {}),
    };
    const surface = context.refineIdentity?.(identity, request);
    if (surface) {
      context.lastPickSource = "cpu-raycast";
      if (context.lastPickFailure !== "id-overflow") {
        context.lastPickFailure = undefined;
      }
      return { ...surface, source: "cpu-raycast" };
    }
    if (!policy.allowCpuFallbackOnRefinementFailure) {
      context.lastPickFailure = "refinement-failed";
      return undefined;
    }
  }
  if (context.lastPickFailure !== "id-overflow") {
    context.lastPickFailure = undefined;
  }
  return identityFromCpu(hit);
}
