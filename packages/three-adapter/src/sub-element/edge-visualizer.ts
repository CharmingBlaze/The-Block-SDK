import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  MeshBasicMaterial,
} from "three";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { ElementIdSets, SubElementDisplayOptions, SubElementVisualTheme } from "./types";
import { isLodIndexVisible, planElementLod } from "./lod";
import { classifyEdge } from "./mesh-query";
import { resolveElementVisualState } from "./resolve-state";
import { edgeDisplayColor } from "./selection-colors";
import type { ObjectLayer, OverlayMeshSource } from "./visualizer-types";

const _color = new Color();

export function refreshEdgePositions(layer: ObjectLayer, source: OverlayMeshSource): void {
  const eCount = layer.edges.size;
  for (let i = 0; i < eCount; i += 1) {
    const id = layer.edges.getId(i)!;
    const ends = source.kernel.getEdgeVertices(id);
    if (!ends) {
      continue;
    }
    const a = source.kernel.vertices.get(ends[0])!.position;
    const b = source.kernel.vertices.get(ends[1])!.position;
    const o = i * 6;
    layer.edgeEndpoints[o] = a[0];
    layer.edgeEndpoints[o + 1] = a[1];
    layer.edgeEndpoints[o + 2] = a[2];
    layer.edgeEndpoints[o + 3] = b[0];
    layer.edgeEndpoints[o + 4] = b[1];
    layer.edgeEndpoints[o + 5] = b[2];
  }
  if (layer.edgeLines) {
    const attr = layer.edgeLines.geometry.getAttribute("position");
    if (attr) {
      attr.needsUpdate = true;
    }
  }
}

export function fillEdgeEndpointBuffer(layer: ObjectLayer, source: OverlayMeshSource): void {
  const eCount = layer.edges.size;
  layer.edgeEndpoints = new Float32Array(eCount * 6);
  for (let i = 0; i < eCount; i += 1) {
    const id = layer.edges.getId(i)!;
    const ends = source.kernel.getEdgeVertices(id);
    if (!ends) {
      continue;
    }
    const a = source.kernel.vertices.get(ends[0])!.position;
    const b = source.kernel.vertices.get(ends[1])!.position;
    const o = i * 6;
    layer.edgeEndpoints[o] = a[0];
    layer.edgeEndpoints[o + 1] = a[1];
    layer.edgeEndpoints[o + 2] = a[2];
    layer.edgeEndpoints[o + 3] = b[0];
    layer.edgeEndpoints[o + 4] = b[1];
    layer.edgeEndpoints[o + 5] = b[2];
  }
}

export function buildEdgeMeshes(
  layer: ObjectLayer,
  theme: SubElementVisualTheme,
  stickGeometry: BufferGeometry,
): void {
  const count = Math.max(1, layer.edges.size);
  const positions = layer.resources.trackGeometry(new BufferGeometry());
  positions.setAttribute("position", new BufferAttribute(layer.edgeEndpoints, 3));
  positions.setAttribute("color", new BufferAttribute(new Float32Array(layer.edges.size * 6), 3));
  const dashed = theme.edges.style === "dashed";
  const lineMat = dashed
    ? new LineDashedMaterial({
        vertexColors: true,
        dashSize: 0.08,
        gapSize: 0.05,
        depthTest: theme.edges.depthTest && !theme.edges.xray,
        transparent: true,
      })
    : new LineBasicMaterial({
        vertexColors: true,
        depthTest: theme.edges.depthTest && !theme.edges.xray,
        transparent: true,
      });
  layer.resources.trackMaterial(lineMat);
  const lines = new LineSegments(positions, lineMat);
  lines.computeLineDistances();
  lines.frustumCulled = false;
  lines.userData.isOverlay = true;
  lines.userData.overlayKind = "edge";
  lines.name = "edge-overlay";
  lines.userData.segmentCount = layer.edges.size;
  layer.group.add(lines);
  layer.edgeLines = lines;

  if (theme.edges.style === "screen-space") {
    const thick = new InstancedMesh(
      stickGeometry,
      layer.resources.trackMaterial(
        new MeshBasicMaterial({
          vertexColors: false,
          transparent: true,
          depthTest: theme.edges.depthTest && !theme.edges.xray,
        }),
      ) as MeshBasicMaterial,
      count,
    );
    thick.frustumCulled = false;
    thick.userData.isOverlay = true;
    thick.userData.overlayPick = true;
    thick.userData.overlayKind = "edge-thick";
    thick.name = "edge-thick-overlay";
    layer.group.add(thick);
    layer.edgeThick = thick;
  }
}

export function writeEdgeColorAt(
  layer: ObjectLayer,
  kernel: HalfEdgeMesh,
  index: number,
  sets: ElementIdSets,
  theme: SubElementVisualTheme,
): void {
  const id = layer.edges.getId(index);
  if (!id || !layer.edgeLines) {
    return;
  }
  const state = resolveElementVisualState(id, sets);
  const role = classifyEdge(kernel, id);
  const color = edgeDisplayColor(theme, role, state);
  layer.edgeWidths[index] = theme.edges.states[state].width ?? theme.edges.width;
  const colors = layer.edgeLines.geometry.getAttribute("color") as BufferAttribute;
  colors.setXYZ(index * 2, color.r * color.opacity, color.g * color.opacity, color.b * color.opacity);
  colors.setXYZ(index * 2 + 1, color.r * color.opacity, color.g * color.opacity, color.b * color.opacity);
  colors.needsUpdate = true;
  if (layer.edgeThick) {
    _color.setRGB(color.r, color.g, color.b);
    layer.edgeThick.setColorAt(index, _color);
    if (layer.edgeThick.instanceColor) {
      layer.edgeThick.instanceColor.needsUpdate = true;
    }
  }
}

export function writeEdgeColors(
  layer: ObjectLayer,
  kernel: HalfEdgeMesh,
  sets: ElementIdSets,
  show: boolean,
  theme: SubElementVisualTheme,
  display: SubElementDisplayOptions,
): void {
  if (!show || !layer.edgeLines) {
    return;
  }
  const lod = planElementLod(layer.edges.size, display.lod.maxEdges, display.lod);
  const colors = layer.edgeLines.geometry.getAttribute("color") as BufferAttribute;
  for (let i = 0; i < layer.edges.size; i += 1) {
    const id = layer.edges.getId(i)!;
    const state = resolveElementVisualState(id, sets);
    const emphasized = state !== "default";
    const visible = isLodIndexVisible(i, lod, emphasized) && state !== "hidden";
    const role = classifyEdge(kernel, id);
    const color = edgeDisplayColor(theme, role, state);
    layer.edgeWidths[i] = theme.edges.states[state].width ?? theme.edges.width;
    const opacity = visible ? color.opacity : 0;
    colors.setXYZ(i * 2, color.r * opacity, color.g * opacity, color.b * opacity);
    colors.setXYZ(i * 2 + 1, color.r * opacity, color.g * opacity, color.b * opacity);
    if (layer.edgeThick) {
      _color.setRGB(color.r, color.g, color.b);
      layer.edgeThick.setColorAt(i, _color);
    }
  }
  colors.needsUpdate = true;
  if (layer.edgeThick?.instanceColor) {
    layer.edgeThick.instanceColor.needsUpdate = true;
  }
}
