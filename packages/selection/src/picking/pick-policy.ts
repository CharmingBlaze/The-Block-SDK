import type {
  ClickPickBackend,
  PickBackfaceMode,
  PickPurpose,
  PointPickRequest,
} from "./pick-request";
import type { PointPickDomain } from "./pick-result";

export type PointPickApplyMode = "replace" | "add" | "toggle" | "subtract";

export type SelectionIntent = PointPickApplyMode;

export interface HoverPickPolicy {
  readonly minimumIntervalMs: number;
  readonly regionSize: number;
}

export const defaultHoverPickPolicy: HoverPickPolicy = {
  minimumIntervalMs: 50,
  regionSize: 1,
};

export type ResolvedPickBackend = "gpu-id-buffer" | "cpu-raycast";

export interface ResolvedPickPolicy {
  readonly purpose: PickPurpose;
  readonly requireSurfacePoint: boolean;
  readonly backfaceMode: PickBackfaceMode;
  readonly backend: ResolvedPickBackend;
  readonly allowCpuFallbackOnOverflow: boolean;
  readonly allowCpuFallbackOnRefinementFailure: boolean;
}

export function purposeNeedsSurface(purpose: PickPurpose): boolean {
  return (
    purpose === "tool-surface" ||
    purpose === "knife" ||
    purpose === "snap" ||
    purpose === "placement" ||
    purpose === "measurement"
  );
}

export function defaultBackfaceMode(domain: PointPickDomain): PickBackfaceMode {
  return domain === "object" ? "front-and-back" : "front-only";
}

export function resolvePickPolicy(request: PointPickRequest): ResolvedPickPolicy {
  const purpose = request.purpose ?? "selection";
  const requireSurfacePoint = request.requireSurfacePoint ?? purposeNeedsSurface(purpose);
  const backfaceMode = request.backfaceMode ?? defaultBackfaceMode(request.domain);
  const clickBackend: ClickPickBackend = request.clickBackend ?? "auto";
  const cpuForced =
    clickBackend === "cpu" ||
    purpose === "hover" ||
    purpose === "snap" ||
    request.xray === true ||
    request.selectThrough === true ||
    request.domain === "vertex" ||
    request.domain === "edge";
  return {
    purpose,
    requireSurfacePoint,
    backfaceMode,
    backend: cpuForced ? "cpu-raycast" : "gpu-id-buffer",
    allowCpuFallbackOnOverflow: request.allowCpuFallbackOnOverflow !== false,
    allowCpuFallbackOnRefinementFailure: request.allowCpuFallbackOnRefinementFailure === true,
  };
}
