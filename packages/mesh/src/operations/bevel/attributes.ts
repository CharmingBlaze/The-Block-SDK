import type { VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { CornerAttributes } from "../../internal/corner-attributes";
import type { MeshOperationContext } from "../contract";
import { sameUndirected } from "./geometry";
import type { SelectedEdgePlan } from "./types";

export function transferEdgeAttributes(
  mesh: HalfEdgeMesh,
  plan: SelectedEdgePlan,
  vA1: VertexId,
  vB1: VertexId,
  vA2: VertexId,
  vB2: VertexId,
  ctx: MeshOperationContext,
): void {
  const pairs: Array<[VertexId, VertexId]> = [
    [vA1, vB1],
    [vA2, vB2],
  ];
  for (const [x, y] of pairs) {
    for (const [edgeId] of mesh.edges) {
      const ends = mesh.getEdgeVertices(edgeId);
      if (!ends) {
        continue;
      }
      if (!sameUndirected(ends[0], ends[1], x, y)) {
        continue;
      }
      const edge = mesh.edges.get(edgeId);
      if (!edge) {
        continue;
      }
      if (ctx.attributes.preserveSeams) {
        edge.isSeam = plan.edgeRecord.isSeam;
        if (plan.edgeRecord.seamChannels) {
          edge.seamChannels = [...plan.edgeRecord.seamChannels];
        }
      }
      if (ctx.attributes.preserveSharps) {
        edge.creaseAngle = plan.edgeRecord.creaseAngle;
        edge.creaseWeight = plan.edgeRecord.creaseWeight;
      }
    }
  }
}

export function hasAnyUv(corners: readonly CornerAttributes[]): boolean {
  return corners.some((corner) => Boolean(corner.uv) || Boolean(corner.uvChannels));
}
