import type { EdgeId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { EdgeCreaseWeight } from "../../types";
import type { ValidationMode } from "../contract";
import type { RepairCreaseWeightsResult, SetEdgeCreaseWeightsRequest } from "./types";
import { clampCreaseWeight, isValidCreaseWeight, requireCreaseWeight } from "./validate";

export function setEdgeCreaseWeights(
  mesh: HalfEdgeMesh,
  request: SetEdgeCreaseWeightsRequest,
  mode: ValidationMode = "strict",
): void {
  const weight = requireCreaseWeight(request.weight, mode);
  const seen = new Set<EdgeId>();
  for (const edgeId of request.edgeIds) {
    if (seen.has(edgeId)) {
      continue;
    }
    seen.add(edgeId);
    const edge = mesh.edges.get(edgeId);
    if (!edge) {
      throw new RangeError(`invalid-crease-weight: Edge ${edgeId} does not exist`);
    }
    edge.creaseWeight = weight;
  }
}

export function repairEdgeCreaseWeights(mesh: HalfEdgeMesh): RepairCreaseWeightsResult {
  const repairedEdgeIds: EdgeId[] = [];
  const skippedEdgeIds: EdgeId[] = [];
  for (const [edgeId, edge] of mesh.edges) {
    const value = edge.creaseWeight;
    if (value === undefined || isValidCreaseWeight(value)) {
      skippedEdgeIds.push(edgeId);
      continue;
    }
    edge.creaseWeight = clampCreaseWeight(value);
    repairedEdgeIds.push(edgeId);
  }
  return { repairedEdgeIds, skippedEdgeIds };
}

export function readCreaseWeight(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
  mode: ValidationMode = "strict",
): EdgeCreaseWeight {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    throw new RangeError(`invalid-crease-weight: Edge ${edgeId} does not exist`);
  }
  if (edge.creaseWeight === undefined) {
    return 0;
  }
  return requireCreaseWeight(edge.creaseWeight, mode);
}
