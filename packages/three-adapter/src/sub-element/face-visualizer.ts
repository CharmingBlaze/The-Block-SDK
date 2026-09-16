import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three";
import type { ElementIdSets, SubElementDisplayOptions, SubElementVisualTheme } from "./types";
import { isLodIndexVisible, planElementLod } from "./lod";
import { faceOutlinePositions } from "./mesh-query";
import { faceFillColor } from "./selection-colors";
import { resolveElementVisualState } from "./resolve-state";
import { growFloats, writeGrowAttribute } from "./geometry-cache";
import type { ObjectLayer, OverlayMeshSource, OverlaySelectionDomain } from "./visualizer-types";

export interface FaceOverlayBuffers {
  fillScratch: Float32Array;
  fillColorScratch: Float32Array;
  outlineScratch: Float32Array;
}

export function buildFaceMeshes(
  layer: ObjectLayer,
  theme: SubElementVisualTheme,
  source: OverlayMeshSource,
): void {
  const fillGeom = layer.resources.trackGeometry(new BufferGeometry());
  fillGeom.setAttribute("position", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
  fillGeom.setAttribute("color", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
  const fillMat = layer.resources.trackMaterial(
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: theme.faces.depthTest && !theme.faces.xray,
      side: theme.faces.frontFaceOnly ? FrontSide : DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  ) as MeshBasicMaterial;
  const fill = new Mesh(fillGeom, fillMat);
  fill.frustumCulled = false;
  fill.userData.isOverlay = true;
  fill.userData.overlayKind = "face";
  fill.name = "face-fill-overlay";
  layer.group.add(fill);
  layer.faceFill = fill;

  const outlineGeom = layer.resources.trackGeometry(new BufferGeometry());
  outlineGeom.setAttribute("position", new BufferAttribute(new Float32Array(0), 3).setUsage(DynamicDrawUsage));
  const outline = new LineSegments(
    outlineGeom,
    layer.resources.trackMaterial(
      new LineBasicMaterial({
        vertexColors: false,
        color: 0xffdd88,
        transparent: true,
        depthTest: theme.faces.depthTest && !theme.faces.xray,
      }),
    ) as LineBasicMaterial,
  );
  outline.frustumCulled = false;
  outline.userData.isOverlay = true;
  outline.userData.overlayKind = "face-outline";
  outline.name = "selection-overlay";
  layer.group.add(outline);
  layer.faceOutline = outline;
  void source;
}

export function writeFaces(
  layer: ObjectLayer,
  source: OverlayMeshSource,
  sets: ElementIdSets,
  show: boolean,
  domain: OverlaySelectionDomain,
  theme: SubElementVisualTheme,
  display: SubElementDisplayOptions,
  buffers: FaceOverlayBuffers,
): void {
  if (!layer.faceFill || !layer.faceOutline) {
    return;
  }
  const style = theme.faces.style;
  const statesOnly = display.showFaces === "states" || !display.editMode;
  let fillCount = 0;
  let colorCount = 0;
  let outlineCount = 0;
  let triangles = 0;
  const posAttr = source.geometry.getAttribute("position");
  const index = source.geometry.getIndex();
  if (!show || style === "hidden" || !posAttr) {
    writeGrowAttribute(layer.faceFill.geometry, "position", 3, buffers.fillScratch, 0);
    writeGrowAttribute(layer.faceOutline.geometry, "position", 3, buffers.outlineScratch, 0);
    layer.faceFill.userData.triangleCount = 0;
    layer.group.userData.triangleCount = 0;
    layer.group.userData.overlayKind = domain === "face" ? "face" : layer.group.userData.overlayKind;
    return;
  }
  const lod = planElementLod(layer.faces.size, display.lod.maxFaces, display.lod);
  const pushFill = (x: number, y: number, z: number, r: number, g: number, b: number): void => {
    buffers.fillScratch = growFloats(buffers.fillScratch, fillCount + 3);
    buffers.fillColorScratch = growFloats(buffers.fillColorScratch, colorCount + 3);
    buffers.fillScratch[fillCount] = x;
    buffers.fillScratch[fillCount + 1] = y;
    buffers.fillScratch[fillCount + 2] = z;
    buffers.fillColorScratch[colorCount] = r;
    buffers.fillColorScratch[colorCount + 1] = g;
    buffers.fillColorScratch[colorCount + 2] = b;
    fillCount += 3;
    colorCount += 3;
  };
  for (let tri = 0; tri < source.mapping.triangleToFace.length; tri += 1) {
    const faceId = source.mapping.triangleToFace[tri]!;
    const faceIndex = layer.faces.getIndex(faceId) ?? 0;
    const state = resolveElementVisualState(faceId, sets);
    if (state === "hidden") {
      continue;
    }
    const emphasized = state !== "default";
    if (statesOnly && !emphasized) {
      continue;
    }
    if (!isLodIndexVisible(faceIndex, lod, emphasized)) {
      continue;
    }
    if (style === "outline") {
      continue;
    }
    const { r, g, b, opacity } = faceFillColor(theme, state, style);
    if (opacity <= 0 && style !== "wireframe") {
      continue;
    }
    for (let k = 0; k < 3; k += 1) {
      const vi = index ? index.getX(tri * 3 + k) : tri * 3 + k;
      pushFill(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi), r, g, b);
    }
    triangles += 1;
  }
  if (style === "outline" || style === "fill-outline" || style === "wireframe") {
    for (let i = 0; i < layer.faces.size; i += 1) {
      const id = layer.faces.getId(i)!;
      const state = resolveElementVisualState(id, sets);
      const emphasized = state !== "default";
      if (style !== "wireframe" && statesOnly && !emphasized) {
        continue;
      }
      if (state === "hidden" || !isLodIndexVisible(i, lod, emphasized)) {
        continue;
      }
      const outline = faceOutlinePositions(source.kernel, id);
      buffers.outlineScratch = growFloats(buffers.outlineScratch, outlineCount + outline.length);
      buffers.outlineScratch.set(outline, outlineCount);
      outlineCount += outline.length;
    }
  }
  writeGrowAttribute(layer.faceFill.geometry, "position", 3, buffers.fillScratch, fillCount);
  writeGrowAttribute(layer.faceFill.geometry, "color", 3, buffers.fillColorScratch, colorCount);
  writeGrowAttribute(layer.faceOutline.geometry, "position", 3, buffers.outlineScratch, outlineCount);
  layer.faceFill.userData.triangleCount = triangles;
  layer.group.userData.triangleCount = triangles;
  layer.group.userData.overlayKind = "face";
  layer.faceFill.visible = style !== "outline" && style !== "wireframe";
  layer.faceOutline.visible = style === "outline" || style === "fill-outline" || style === "wireframe";
}
