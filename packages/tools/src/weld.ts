import type { IdFactory } from "@modeling-kit/core";
import {
  createMeshOperationContext,
  mergeVerticesByDistance,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";

export interface WeldResult {
  readonly weldedCount: number;
  readonly remainingVertices: number;
}

export function weldVertices(mesh: HalfEdgeMesh, epsilon: number, ids: IdFactory): WeldResult {
  const result = mergeVerticesByDistance(mesh, epsilon, createMeshOperationContext(ids));
  return {
    weldedCount: result.mergedCount,
    remainingVertices: mesh.vertices.size,
  };
}
