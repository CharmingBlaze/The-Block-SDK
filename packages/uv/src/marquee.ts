import type { UVEdgeId, UVFaceId, UVIslandId, UVVertexId } from "@modeling-kit/core";
import type { UVElementId, UVSelectionMode } from "./selection";
import type { UVTopology } from "./topology";

export interface UvBox {
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

export function normalizeUvBox(a: readonly [number, number], b: readonly [number, number]): UvBox {
  return {
    minU: Math.min(a[0], b[0]),
    minV: Math.min(a[1], b[1]),
    maxU: Math.max(a[0], b[0]),
    maxV: Math.max(a[1], b[1]),
  };
}

export function pointInUvBox(u: number, v: number, box: UvBox): boolean {
  return u >= box.minU && u <= box.maxU && v >= box.minV && v <= box.maxV;
}

export function pointInUvPolygon(
  u: number,
  v: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersect = a[1] > v !== b[1] > v && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1] || 1) + a[0];
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function vertexPoint(topology: UVTopology, id: UVVertexId): readonly [number, number] | undefined {
  const vertex = topology.vertices.get(id);
  return vertex ? [vertex.u, vertex.v] : undefined;
}

function elementPoints(topology: UVTopology, mode: UVSelectionMode, id: UVElementId): readonly (readonly [number, number])[] {
  if (mode === "vertex") {
    const point = vertexPoint(topology, id as UVVertexId);
    return point ? [point] : [];
  }
  if (mode === "edge") {
    const edge = topology.edges.get(id as UVEdgeId);
    if (!edge) {
      return [];
    }
    const a = vertexPoint(topology, edge.a);
    const b = vertexPoint(topology, edge.b);
    return a && b ? [a, b] : [];
  }
  if (mode === "face") {
    const face = topology.faces.get(id as UVFaceId);
    return (face?.vertexIds ?? []).flatMap((vertexId) => {
      const point = vertexPoint(topology, vertexId);
      return point ? [point] : [];
    });
  }
  const island = topology.islands.get(id as UVIslandId);
  return (island?.vertexIds ?? []).flatMap((vertexId) => {
    const point = vertexPoint(topology, vertexId);
    return point ? [point] : [];
  });
}

function allIds(topology: UVTopology, mode: UVSelectionMode): UVElementId[] {
  if (mode === "vertex") {
    return [...topology.vertices.keys()];
  }
  if (mode === "edge") {
    return [...topology.edges.keys()];
  }
  if (mode === "face") {
    return [...topology.faces.keys()];
  }
  return [...topology.islands.keys()];
}

export function uvIdsInBox(topology: UVTopology, mode: UVSelectionMode, box: UvBox): UVElementId[] {
  return allIds(topology, mode).filter((id) => elementPoints(topology, mode, id).some((p) => pointInUvBox(p[0], p[1], box)));
}

export function uvIdsInPolygon(
  topology: UVTopology,
  mode: UVSelectionMode,
  polygon: readonly (readonly [number, number])[],
): UVElementId[] {
  if (polygon.length < 3) {
    return [];
  }
  return allIds(topology, mode).filter((id) =>
    elementPoints(topology, mode, id).some((p) => pointInUvPolygon(p[0], p[1], polygon)),
  );
}
