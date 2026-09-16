import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { EdgeRecord } from "../../types";
import type { MeshOperationResult } from "../contract";

export type BevelWidthMode = "offset" | "percent";
export type SimpleBevelMiterMode = "sharp" | "clip";
export type BevelOverlapMode = "clamp" | "error";

export const DEFAULT_MITER_LIMIT = 2;
export const DEFAULT_WIDTH_FRACTION = 0.45;

export interface SimpleBevelOptions {
  readonly miterLimit?: number;
}

export interface BevelEdgesRequest {
  readonly edgeIds: readonly EdgeId[];
  /** World-space distance when `widthMode` is `"offset"` (default). */
  readonly offset?: number;
  /** Alias for `offset`. */
  readonly width?: number;
  readonly widthMode?: BevelWidthMode;
  /**
   * Polyline rounding between the two offset endpoints. This is not a
   * cylindrical Blender-style profile; it interpolates around the original vertex.
   */
  readonly segments?: number;
  readonly miterMode?: SimpleBevelMiterMode;
  readonly overlapMode?: BevelOverlapMode;
  readonly allowClipFallback?: boolean;
  readonly miterLimit?: number;
}

export interface BevelEdgesResult extends MeshOperationResult {
  readonly chamferFaceIds: FaceId[];
  readonly remainingFaceIds: FaceId[];
  readonly appliedWidth: number;
  readonly appliedWidths: ReadonlyMap<EdgeId, number>;
  readonly beveledEdgeIds: readonly EdgeId[];
  readonly createdFaceIds: readonly FaceId[];
}

export interface SelectedEdgePlan {
  readonly edgeId: EdgeId;
  readonly a: VertexId;
  readonly b: VertexId;
  readonly f1: FaceId;
  readonly f2: FaceId;
  readonly nA1: VertexId;
  readonly nB1: VertexId;
  readonly nA2: VertexId;
  readonly nB2: VertexId;
  readonly edgeRecord: EdgeRecord;
}

export type BevelComponentKind = "isolated" | "open-chain" | "closed-loop";

export interface BevelComponent {
  readonly kind: BevelComponentKind;
  readonly edgeIds: readonly EdgeId[];
  readonly vertexIds: readonly VertexId[];
}

export type CornerMiterKind = "sharp" | "clip";
