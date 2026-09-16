import type { FaceId, VertexId } from "@modeling-kit/core";
import type { SkinInfluence } from "../../internal/attribute-interpolation";
import type { MeshOperationResult } from "../contract";

export interface CatmullClarkRequest {
  readonly iterations?: number;
  readonly skinWeights?: ReadonlyMap<VertexId, readonly SkinInfluence[]>;
}

export interface CatmullClarkResult extends MeshOperationResult {
  readonly newFaceIds: readonly FaceId[];
  readonly iterations: number;
  readonly skinWeights?: ReadonlyMap<VertexId, readonly SkinInfluence[]>;
}

export type Vec3 = [number, number, number];
