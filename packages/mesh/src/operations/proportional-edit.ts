/**
 * Proportional editing — soft selection with distance-based falloff.
 *
 * Computes influence weights for vertices within a radius of an active
 * vertex, enabling smooth deformations similar to Blender's proportional
 * editing mode.
 *
 * @module proportional-edit
 */

import type { VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";

/** Falloff curve types for proportional editing. */
export type ProportionalFalloff =
  | "smooth"     // Smooth (default, cosine-like)
  | "sphere"     // Spherical linear
  | "root"       // Square root
  | "sharp"      // Quadratic (sharp falloff)
  | "linear"     // Linear
  | "constant";  // Constant (all within radius get full weight)

/** A vertex with its computed influence weight. */
export interface ProportionalVertex {
  readonly vertexId: VertexId;
  /** Influence weight [0, 1]. 1 = fully affected, 0 = unaffected. */
  readonly weight: number;
}

/** Options for proportional influence computation. */
export interface ProportionalEditOptions {
  /** Radius of influence. Vertices beyond this distance get weight 0. */
  readonly radius: number;
  /** Falloff curve type. Default: "smooth". */
  readonly falloff?: ProportionalFalloff;
  /** Only include connected vertices (default true). */
  readonly connectedOnly?: boolean;
}

/**
 * Compute proportional influence weights for vertices around an active vertex.
 *
 * Returns an array of { vertexId, weight } pairs sorted by descending weight.
 * The active vertex always has weight 1.0.
 *
 * @example
 * ```ts
 * const influenced = computeProportionalInfluence(mesh, "v-5", {
 *   radius: 2.0,
 *   falloff: "smooth",
 * });
 * // Apply transform weighted by influence:
 * for (const { vertexId, weight } of influenced) {
 *   moveVertexToward(mesh, vertexId, target, weight);
 * }
 * ```
 */
export function computeProportionalInfluence(
  mesh: HalfEdgeMesh,
  activeVertexId: VertexId,
  options: ProportionalEditOptions,
): ProportionalVertex[] {
  const center = mesh.vertices.get(activeVertexId);
  if (!center) return [];

  const radius = Math.max(0, options.radius);
  const falloff = options.falloff ?? "smooth";
  const connectedOnly = options.connectedOnly !== false;

  // Collect reachable vertices (BFS if connected-only)
  const candidates = new Map<VertexId, number>(); // distance
  if (connectedOnly) {
    const visited = new Set<VertexId>();
    const queue: VertexId[] = [activeVertexId];
    visited.add(activeVertexId);
    candidates.set(activeVertexId, 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = candidates.get(current)!;
      for (const edgeId of mesh.getVertexEdges(current)) {
        const ends = mesh.getEdgeVertices(edgeId);
        if (!ends) continue;
        for (const neighbor of ends) {
          if (neighbor === current || visited.has(neighbor)) continue;
          const nPos = mesh.vertices.get(neighbor)!.position;
          const cPos = mesh.vertices.get(current)!.position;
          const dist = currentDist + Math.hypot(
            nPos[0] - cPos[0], nPos[1] - cPos[1], nPos[2] - cPos[2],
          );
          if (dist <= radius) {
            visited.add(neighbor);
            candidates.set(neighbor, dist);
            queue.push(neighbor);
          }
        }
      }
    }
  } else {
    // All vertices within radius
    for (const [id, v] of mesh.vertices) {
      if (id === activeVertexId) {
        candidates.set(id, 0);
        continue;
      }
      const d = Math.hypot(
        v.position[0] - center.position[0],
        v.position[1] - center.position[1],
        v.position[2] - center.position[2],
      );
      if (d <= radius) candidates.set(id, d);
    }
  }

  // Compute weights with falloff
  const result: ProportionalVertex[] = [];
  for (const [id, dist] of candidates) {
    if (id === activeVertexId) {
      result.push({ vertexId: id, weight: 1.0 });
      continue;
    }
    const t = dist / radius; // normalized [0, 1]
    const w = applyFalloff(t, falloff);
    result.push({ vertexId: id, weight: w });
  }

  return result.sort((a, b) => b.weight - a.weight);
}

/** Apply a falloff curve to a normalized distance. */
export function applyFalloff(t: number, falloff: ProportionalFalloff): number {
  const clamped = Math.min(1, Math.max(0, t));
  switch (falloff) {
    case "smooth":    return (Math.cos(clamped * Math.PI) + 1) * 0.5; // cosine
    case "sphere":    return Math.sqrt(1 - clamped * clamped);          // circular
    case "root":      return Math.sqrt(1 - clamped);                   // sqrt
    case "sharp":     return (1 - clamped) * (1 - clamped);            // quadratic
    case "linear":    return 1 - clamped;                              // linear
    case "constant":  return 1;                                         // constant
  }
}