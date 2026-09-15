import type { UVChannelId, UVEdgeId, UVFaceId, UVIslandId, UVVertexId } from "@modeling-kit/core";
import type { UVSelectionState } from "./selection";
import type { UVTopology } from "./topology";
import {
  hitRadiusUv,
  resolveVisualState,
  screenPointSize,
  type UVElementVisualState,
  type UVVisualTheme,
} from "./visual";

export interface Rect2 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UVTileDrawData {
  readonly u: number;
  readonly v: number;
  readonly rect: Rect2;
}

export interface UVVertexDrawData {
  readonly id: UVVertexId;
  readonly u: number;
  readonly v: number;
  readonly state: UVElementVisualState;
  readonly pointSize: number;
  readonly pickRadiusUv: number;
  readonly pinned: boolean;
}

export interface UVEdgeDrawData {
  readonly id: UVEdgeId;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly seam: boolean;
  readonly boundary: boolean;
  readonly state: UVElementVisualState;
}

export interface UVFaceDrawData {
  readonly id: UVFaceId;
  readonly faceId: string;
  readonly points: readonly (readonly [number, number])[];
  readonly state: UVElementVisualState;
  readonly flipped: boolean;
}

export interface UVIslandDrawData {
  readonly id: UVIslandId;
  readonly bounds: Rect2;
  readonly state: UVElementVisualState;
}

export interface UVSelectionDrawData {
  readonly mode: string;
  readonly ids: readonly string[];
  readonly activeId: string | null;
}

export interface UVDiagnosticDrawData {
  readonly flippedFaceIds: readonly string[];
  readonly warningVertexIds: readonly string[];
}

export interface UVViewData {
  readonly channelId: UVChannelId;
  readonly textureBounds: Rect2;
  readonly tiles: UVTileDrawData[];
  readonly vertices: UVVertexDrawData[];
  readonly edges: UVEdgeDrawData[];
  readonly faces: UVFaceDrawData[];
  readonly islands: UVIslandDrawData[];
  readonly selection: UVSelectionDrawData;
  readonly diagnostics: UVDiagnosticDrawData;
}

export interface UVViewTransform {
  readonly panU: number;
  readonly panV: number;
  readonly zoom: number;
  readonly dpr: number;
}

export const IDENTITY_UV_VIEW: UVViewTransform = {
  panU: 0,
  panV: 0,
  zoom: 256,
  dpr: 1,
};

export function buildUvViewData(input: {
  readonly topology: UVTopology;
  readonly selection: UVSelectionState;
  readonly hoveredId: string | null;
  readonly theme: UVVisualTheme;
  readonly view: UVViewTransform;
  readonly textureWidth: number;
  readonly textureHeight: number;
}): UVViewData {
  const { topology, selection, hoveredId, theme, view } = input;
  const pointSize = screenPointSize(theme, view.zoom, view.dpr);
  const pickR = hitRadiusUv(theme, view.zoom, view.dpr);
  const selected = new Set(selection.ids);
  const vertices: UVVertexDrawData[] = [];
  const warningVertexIds: string[] = [];
  for (const vertex of topology.vertices.values()) {
    const out = vertex.u < 0 || vertex.v < 0 || vertex.u > 1 || vertex.v > 1;
    if (out) {
      warningVertexIds.push(vertex.id);
    }
    vertices.push({
      id: vertex.id,
      u: vertex.u,
      v: vertex.v,
      pinned: vertex.pinned,
      pointSize,
      pickRadiusUv: pickR,
      state: resolveVisualState({
        warning: out,
        active: selection.activeId === vertex.id,
        selected: selected.has(vertex.id),
        hovered: hoveredId === vertex.id,
        pinned: vertex.pinned,
      }),
    });
  }
  const edges: UVEdgeDrawData[] = [];
  for (const edge of topology.edges.values()) {
    const a = topology.vertices.get(edge.a);
    const b = topology.vertices.get(edge.b);
    if (!a || !b) {
      continue;
    }
    edges.push({
      id: edge.id,
      ax: a.u,
      ay: a.v,
      bx: b.u,
      by: b.v,
      seam: edge.seam,
      boundary: edge.boundary,
      state: resolveVisualState({
        active: selection.activeId === edge.id,
        selected: selected.has(edge.id),
        hovered: hoveredId === edge.id,
      }),
    });
  }
  const faces: UVFaceDrawData[] = [];
  const flippedFaceIds: string[] = [];
  for (const face of topology.faces.values()) {
    if (face.flipped) {
      flippedFaceIds.push(face.faceId);
    }
    faces.push({
      id: face.id,
      faceId: face.faceId,
      points: face.vertexIds.map((id) => {
        const vertex = topology.vertices.get(id);
        return [vertex?.u ?? 0, vertex?.v ?? 0] as const;
      }),
      flipped: face.flipped,
      state: resolveVisualState({
        warning: face.flipped,
        active: selection.activeId === face.id,
        selected: selected.has(face.id),
        hovered: hoveredId === face.id,
      }),
    });
  }
  const islands: UVIslandDrawData[] = [];
  for (const island of topology.islands.values()) {
    islands.push({
      id: island.id,
      bounds: {
        x: island.minU,
        y: island.minV,
        width: island.maxU - island.minU,
        height: island.maxV - island.minV,
      },
      state: resolveVisualState({
        active: selection.activeId === island.id,
        selected: selected.has(island.id),
        hovered: hoveredId === island.id,
      }),
    });
  }
  const tiles: UVTileDrawData[] = [];
  for (let v = -1; v <= 1; v += 1) {
    for (let u = -1; u <= 1; u += 1) {
      tiles.push({ u, v, rect: { x: u, y: v, width: 1, height: 1 } });
    }
  }
  return {
    channelId: topology.channelId,
    textureBounds: { x: 0, y: 0, width: 1, height: 1 },
    tiles,
    vertices,
    edges,
    faces,
    islands,
    selection: {
      mode: selection.mode,
      ids: selection.ids,
      activeId: selection.activeId,
    },
    diagnostics: { flippedFaceIds, warningVertexIds },
  };
}
