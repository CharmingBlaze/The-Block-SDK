import type { EdgeId } from "@modeling-kit/core";
import type { EdgeCreaseWeight } from "../../types";

export type { EdgeCreaseWeight };

/** Edges with `creaseWeight > CREASE_EPSILON` count as crease edges. */
export const CREASE_EPSILON = 1e-6;

export const CREASE_WEIGHT_MIN = 0;
export const CREASE_WEIGHT_MAX = 1;

export interface SetEdgeCreaseWeightsRequest {
  readonly edgeIds: readonly EdgeId[];
  readonly weight: EdgeCreaseWeight;
}

export interface RepairCreaseWeightsResult {
  readonly repairedEdgeIds: readonly EdgeId[];
  readonly skippedEdgeIds: readonly EdgeId[];
}
