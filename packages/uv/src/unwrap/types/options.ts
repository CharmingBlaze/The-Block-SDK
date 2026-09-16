import type { FaceId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";

export type UvUnwrapMethod = "automatic" | "planar" | "box" | "cylindrical" | "spherical";

export type PinnedUvPolicy = "reject" | "ignore-with-warning";

export interface AutomaticUvUnwrapOptions {
  /**
   * Existing seam edges that must separate charts.
   * watlas 1.0.1 does not accept explicit seam constraints. Only `false` is supported.
   */
  readonly respectExistingSeams?: boolean;
  /**
   * Preserve existing valid UV islands where supported.
   * Not supported by the xatlas backend: existing UVs are per-corner, xatlas input is per-vertex.
   */
  readonly preserveExistingCharts?: boolean;
  readonly resolution?: number;
  readonly padding?: number;
  readonly rotateCharts?: boolean;
  readonly blockAlign?: boolean;
  readonly bilinearPadding?: boolean;
  readonly maxChartArea?: number;
  readonly maxBoundaryLength?: number;
  readonly pinnedUvPolicy?: PinnedUvPolicy;
  readonly ignorePins?: boolean;
}

export interface AutomaticUvUnwrapRequest {
  readonly mesh: HalfEdgeMesh;
  readonly faceIds?: readonly FaceId[];
  readonly uvChannel?: string | UVChannelId;
  readonly options?: AutomaticUvUnwrapOptions;
}
