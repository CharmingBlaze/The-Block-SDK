import type { CornerId, FaceId } from "@modeling-kit/core";
import type { UvUnwrapBackendResult } from "./backend";

export interface UvTriangulationMapping {
  readonly triangleFaceIds: readonly FaceId[];
  readonly triangleCornerIds: readonly [CornerId, CornerId, CornerId][];
  readonly triangleVertexIndices: readonly [number, number, number][];
}

export interface UvChartBuffers {
  readonly result: UvUnwrapBackendResult;
  readonly mapping: UvTriangulationMapping;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}
