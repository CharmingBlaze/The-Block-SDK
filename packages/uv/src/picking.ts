import type { UVEdgeId, UVFaceId, UVIslandId, UVVertexId } from "@modeling-kit/core";
import type { UVSelectionMode } from "./selection";
import type { UVTopology } from "./topology";
import { hitRadiusUv, type UVVisualTheme } from "./visual";
import type { UVViewTransform } from "./view-data";

export interface UVPickHit {
  readonly mode: UVSelectionMode;
  readonly id: UVVertexId | UVEdgeId | UVFaceId | UVIslandId;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len < 1e-12 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInPolygon(px: number, py: number, points: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    const intersect = a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1] + 0) + a[0];
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export function pickUv(
  topology: UVTopology,
  uv: readonly [number, number],
  mode: UVSelectionMode,
  theme: UVVisualTheme,
  view: UVViewTransform,
): UVPickHit | null {
  const radius = hitRadiusUv(theme, view.zoom, view.dpr);
  if (mode === "vertex") {
    let best: UVVertexId | null = null;
    let bestD = radius * radius;
    for (const vertex of topology.vertices.values()) {
      const d = dist2(uv[0], uv[1], vertex.u, vertex.v);
      if (d <= bestD) {
        bestD = d;
        best = vertex.id;
      }
    }
    return best ? { mode, id: best } : null;
  }
  if (mode === "edge") {
    let best: UVEdgeId | null = null;
    let bestD = radius;
    for (const edge of topology.edges.values()) {
      const a = topology.vertices.get(edge.a);
      const b = topology.vertices.get(edge.b);
      if (!a || !b) {
        continue;
      }
      const d = distToSegment(uv[0], uv[1], a.u, a.v, b.u, b.v);
      if (d <= bestD) {
        bestD = d;
        best = edge.id;
      }
    }
    return best ? { mode, id: best } : null;
  }
  if (mode === "face" || mode === "island") {
    for (const face of topology.faces.values()) {
      const points = face.vertexIds.map((id) => {
        const vertex = topology.vertices.get(id);
        return [vertex?.u ?? 0, vertex?.v ?? 0] as const;
      });
      if (pointInPolygon(uv[0], uv[1], points)) {
        return mode === "face" ? { mode, id: face.id } : { mode, id: face.islandId };
      }
    }
  }
  return null;
}
