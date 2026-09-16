import type { FaceId } from "@modeling-kit/core";

export type SourceTopologyKind = "triangles" | "polygons" | "mixed";

/**
 * Explicit face loop. Size is never inferred from a packed index count.
 */
export interface SourceFace {
  readonly indices: readonly number[];
  readonly sourceFaceIndex: number;
  readonly materialSlot?: number;
}

export interface GeometrySourceData {
  readonly positions: ArrayLike<number>;
  readonly faces: readonly SourceFace[];
  readonly uvs?: ArrayLike<number> | undefined;
  readonly normals?: ArrayLike<number> | undefined;
  readonly topologyKind: SourceTopologyKind;
  readonly sourceName?: string;
}

export interface FlatPolygonIndexData {
  readonly indices: ArrayLike<number>;
  readonly faceOffsets: ArrayLike<number>;
}

export interface GeometryBuildWarning {
  readonly code: "winding-reversed" | "degenerate-skipped";
  readonly message: string;
  readonly sourceFaceIndex?: number;
}

export interface SourceFaceMapping {
  readonly sourceFaceToCanonicalFaceIds: readonly (readonly FaceId[])[];
}
