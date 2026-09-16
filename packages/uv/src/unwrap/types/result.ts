import type { CornerId, EdgeId, FaceId, UVChannelId } from "@modeling-kit/core";
import type { ConnectedUvIsland } from "../../islands";
import type { UvBounds } from "../../types";

export type UvUnwrapWarningCode =
  | "overlap-with-unselected"
  | "pins-ignored"
  | "zero-area-triangle"
  | "flipped-triangle"
  | "manual-seams-not-respected";

export interface UvUnwrapWarning {
  readonly code: UvUnwrapWarningCode;
  readonly message: string;
  readonly cornerIds?: readonly CornerId[];
  readonly faceIds?: readonly FaceId[];
}

export interface UvDistortionMetrics {
  readonly flippedTriangleCount: number;
  readonly zeroAreaTriangleCount: number;
  readonly meanAngleDistortion: number;
  readonly maxAngleDistortion: number;
  readonly meanAreaDistortion: number;
  readonly maxAreaDistortion: number;
}

export interface UvUnwrapStatistics {
  readonly chartCount: number;
  readonly islandCount: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly inputVertexCount: number;
  readonly outputVertexCount: number;
  readonly triangleCount: number;
  readonly distortion: UvDistortionMetrics;
}

export interface UvIslandResult {
  readonly faceIds: readonly FaceId[];
  readonly cornerIds: readonly CornerId[];
  readonly bounds: UvBounds;
}

export interface AutomaticUvUnwrapResult {
  readonly cornerUvs: ReadonlyMap<CornerId, readonly [number, number]>;
  readonly seamEdgeIds: ReadonlySet<EdgeId>;
  readonly islands: readonly UvIslandResult[];
  readonly warnings: readonly UvUnwrapWarning[];
  readonly statistics: UvUnwrapStatistics;
  readonly targetedFaceIds: readonly FaceId[];
  readonly uvChannel: UVChannelId;
}

export type PreparedUvUnwrap = AutomaticUvUnwrapResult;

export type { ConnectedUvIsland, UvBounds };
