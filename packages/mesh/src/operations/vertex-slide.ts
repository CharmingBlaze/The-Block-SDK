/**
 * Vertex slide — slides a vertex along its connected edges.
 *
 * Moves a vertex along one of its incident edges while keeping it on the
 * same topological surface. Essential for fine-tuning geometry without
 * breaking edge flow.
 *
 * @module vertex-slide
 */

import type { VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";

/** Request to slide a vertex along an incident edge. */
export interface VertexSlideRequest {
  readonly vertexId: VertexId;
  readonly edgeId: string;
  readonly factor: number;
}

export interface VertexSlideResult {
  readonly position: readonly [number, number, number];
}

/**
 * Slide a vertex along a specified incident edge.
 *
 * The vertex is moved to a new position interpolated between the two
 * endpoints of the edge. The factor is clamped to [0, 1].
 *
 * @example
 * ```ts
 * // Slide vertex v1 to the midpoint of edge e0
 * const result = slideVertex(mesh, {
 *   vertexId: "v1", edgeId: "e0", factor: 0.5,
 * }, ctx);
 * ```
 */
export function slideVertex(
  mesh: HalfEdgeMesh,
  vertexId: VertexId,
  edgeId: string,
  factor: number,
): VertexSlideResult {
  const vertex = mesh.vertices.get(vertexId);
  if (!vertex) throw new RangeError(`Vertex ${vertexId} does not exist`);
  const edges = mesh.getVertexEdges(vertexId);
  if (!edges.some((e) => e === edgeId)) {
    throw new RangeError(`Edge ${edgeId} is not incident to vertex ${vertexId}`);
  }
  const ends = mesh.getEdgeVertices(edgeId as unknown as import("@modeling-kit/core").EdgeId);
  if (!ends) throw new RangeError(`Edge ${edgeId} has no vertices`);
  const isStart = ends[0] === vertexId;
  const anchorPos = mesh.vertices.get(isStart ? ends[1] : ends[0])!.position;
  const targetPos = mesh.vertices.get(isStart ? ends[0] : ends[1])!.position;
  const t = Math.min(1, Math.max(0, factor));
  const newPos: [number, number, number] = [
    targetPos[0] + (anchorPos[0] - targetPos[0]) * t,
    targetPos[1] + (anchorPos[1] - targetPos[1]) * t,
    targetPos[2] + (anchorPos[2] - targetPos[2]) * t,
  ];
  mesh.vertices.set(vertexId, { ...vertex, position: newPos });
  mesh.bumpPositionsRevision();
  return { position: newPos };
}