/**
 * Knife tool types — data structures for knife cut planning.
 * Pure types with no runtime imports.
 *
 * @module knife-types
 */

import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { Vec3 } from "@modeling-kit/math";
import type { MeshOperationWarning } from "../contract";
import type { CutEndpoint } from "../cut-face";

/** 3D position tuple for knife point placement. */
export type Vec3Tuple = readonly [number, number, number];

/** A user-placed knife point on a mesh surface. */
export interface KnifePoint {
  readonly faceId: FaceId;
  readonly position: Vec3;
  readonly attachment:
    | { readonly type: "vertex"; readonly vertexId: VertexId }
    | { readonly type: "edge"; readonly edgeId: EdgeId; readonly t: number }
    | { readonly type: "face" };
}

/** A single cut segment within one face. */
export interface PlannedCut {
  readonly faceId: FaceId;
  readonly start: CutEndpoint;
  readonly end: CutEndpoint;
}

/** Complete output of the knife planner. */
export interface KnifeCutPlan {
  readonly cuts: readonly PlannedCut[];
  readonly warnings: readonly MeshOperationWarning[];
}

/** Request to plan knife strokes from world-space points. */
export interface KnifePlanRequest {
  readonly points: readonly Vec3Tuple[];
  readonly snapRadius?: number;
}

/** A snap hit on the mesh. */
export interface KnifePlanHit {
  readonly point: Vec3Tuple;
  readonly endpoint: CutEndpoint;
  readonly faceIds: readonly FaceId[];
}

/** A resolved cut between two snapped points. */
export interface KnifePlanCut {
  readonly faceId: FaceId;
  readonly from: CutEndpoint;
  readonly to: CutEndpoint;
}

/** The full knife plan: hits + cuts + warnings. */
export interface KnifePlan {
  readonly hits: readonly KnifePlanHit[];
  readonly cuts: readonly KnifePlanCut[];
  readonly warnings: readonly MeshOperationWarning[];
}