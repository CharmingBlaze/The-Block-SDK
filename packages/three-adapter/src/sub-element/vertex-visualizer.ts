import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  type Material,
} from "three";
import type { CustomVertexMarker, ElementIdSets, SubElementDisplayOptions, SubElementVisualTheme, VertexMarkerStyle } from "./types";
import { isLodIndexVisible, planElementLod } from "./lod";
import { resolveElementVisualState } from "./resolve-state";
import { vertexDisplayColor } from "./selection-colors";
import type { ObjectLayer, OverlayMeshSource } from "./visualizer-types";

const _color = new Color();

export interface VertexVisualizerAssets {
  cube: BufferGeometry;
  sphere: BufferGeometry;
  customVertex: CustomVertexMarker | null;
  spriteTextures: { square?: CanvasTexture; circle?: CanvasTexture };
  trackRootTexture: (texture: CanvasTexture) => CanvasTexture;
}

export function refreshVertexPositions(layer: ObjectLayer, source: OverlayMeshSource): void {
  const vCount = layer.vertices.size;
  for (let i = 0; i < vCount; i += 1) {
    const id = layer.vertices.getId(i)!;
    const p = source.kernel.vertices.get(id)?.position;
    if (!p) {
      continue;
    }
    layer.vertexPositions[i * 3] = p[0];
    layer.vertexPositions[i * 3 + 1] = p[1];
    layer.vertexPositions[i * 3 + 2] = p[2];
  }
  const pointMesh = layer.vertexMesh;
  if (pointMesh instanceof Points) {
    const attr = pointMesh.geometry.getAttribute("position");
    if (attr) {
      attr.needsUpdate = true;
    }
  }
}

export function fillVertexPositionBuffer(layer: ObjectLayer, source: OverlayMeshSource): void {
  const vCount = layer.vertices.size;
  layer.vertexPositions = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i += 1) {
    const id = layer.vertices.getId(i)!;
    const p = source.kernel.vertices.get(id)!.position;
    layer.vertexPositions.set(p, i * 3);
  }
}

export function buildVertexMeshes(
  layer: ObjectLayer,
  theme: SubElementVisualTheme,
  assets: VertexVisualizerAssets,
): void {
  const count = Math.max(1, layer.vertices.size);
  const style = theme.vertices.style;
  const pickGeom = assets.cube;
  const pickMat = layer.resources.trackMaterial(
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: 0x000000,
    }),
  ) as MeshBasicMaterial;
  const pick = new InstancedMesh(pickGeom, pickMat, count);
  pick.frustumCulled = false;
  pick.userData.isOverlay = true;
  pick.userData.overlayPick = true;
  pick.userData.overlayKind = "vertex-pick";
  pick.name = "vertex-pick-overlay";
  layer.group.add(pick);
  layer.vertexPick = pick;

  if (style === "square-sprite" || style === "circle-sprite") {
    const points = new Points(makeVertexPointGeometry(layer), makeSpriteMaterial(layer, theme, assets, style));
    points.frustumCulled = false;
    points.userData.isOverlay = true;
    points.userData.overlayKind = "vertex";
    points.name = "vertex-overlay";
    layer.group.add(points);
    layer.vertexMesh = points;
    return;
  }
  if (style === "hidden") {
    return;
  }
  const visual = new InstancedMesh(vertexGeometry(style, assets), vertexMaterial(layer, theme, assets, style), count);
  visual.frustumCulled = false;
  visual.userData.isOverlay = true;
  visual.userData.overlayKind = "vertex";
  visual.name = "vertex-overlay";
  layer.group.add(visual);
  layer.vertexMesh = visual;
}

export function writeVertexColorAt(layer: ObjectLayer, index: number, sets: ElementIdSets, theme: SubElementVisualTheme): void {
  const id = layer.vertices.getId(index);
  if (!id) {
    return;
  }
  const state = resolveElementVisualState(id, sets);
  const color = vertexDisplayColor(theme, state);
  const mesh = layer.vertexMesh;
  if (mesh instanceof Points) {
    const colors = mesh.geometry.getAttribute("color") as BufferAttribute;
    const a = color.opacity;
    colors.setXYZW(index, color.r, color.g, color.b, a);
    layer.vertexScales[index] = theme.vertices.states[state].scale ?? 1;
    colors.needsUpdate = true;
    return;
  }
  if (mesh instanceof InstancedMesh) {
    _color.setHex(theme.vertices.states[state].color);
    mesh.setColorAt(index, _color);
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

export function writeVertexColors(
  layer: ObjectLayer,
  sets: ElementIdSets,
  show: boolean,
  theme: SubElementVisualTheme,
  display: SubElementDisplayOptions,
): void {
  if (!show && theme.vertices.style !== "hidden") {
    return;
  }
  const lod = planElementLod(layer.vertices.size, display.lod.maxVertices, display.lod);
  const mesh = layer.vertexMesh;
  if (mesh instanceof Points) {
    const colors = mesh.geometry.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < layer.vertices.size; i += 1) {
      const id = layer.vertices.getId(i)!;
      const state = resolveElementVisualState(id, sets);
      const emphasized = state !== "default";
      const visible = isLodIndexVisible(i, lod, emphasized) && state !== "hidden";
      const color = vertexDisplayColor(theme, state);
      const a = visible ? color.opacity : 0;
      colors.setXYZW(i, color.r, color.g, color.b, a);
      layer.vertexScales[i] = theme.vertices.states[state].scale ?? 1;
    }
    colors.needsUpdate = true;
    return;
  }
  if (!(mesh instanceof InstancedMesh) && !layer.vertexPick) {
    return;
  }
  for (let i = 0; i < layer.vertices.size; i += 1) {
    const id = layer.vertices.getId(i)!;
    const state = resolveElementVisualState(id, sets);
    _color.setHex(theme.vertices.states[state].color);
    if (mesh instanceof InstancedMesh) {
      mesh.setColorAt(i, _color);
    }
  }
  if (mesh instanceof InstancedMesh && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

function vertexGeometry(style: VertexMarkerStyle, assets: VertexVisualizerAssets): BufferGeometry {
  if (style === "custom" && assets.customVertex) {
    return assets.customVertex.geometry;
  }
  return style === "sphere" ? assets.sphere : assets.cube;
}

function vertexMaterial(
  layer: ObjectLayer,
  theme: SubElementVisualTheme,
  assets: VertexVisualizerAssets,
  style: VertexMarkerStyle,
): Material {
  if (style === "custom" && assets.customVertex) {
    return assets.customVertex.material;
  }
  const xray = theme.vertices.xray;
  return layer.resources.trackMaterial(
    new MeshStandardMaterial({
      roughness: style === "sphere" ? 0.35 : 0.55,
      metalness: 0.05,
      transparent: true,
      depthTest: theme.vertices.depthTest && !xray,
      depthWrite: !xray,
    }),
  );
}

function makeSpriteMaterial(
  layer: ObjectLayer,
  theme: SubElementVisualTheme,
  assets: VertexVisualizerAssets,
  style: "square-sprite" | "circle-sprite",
): ShaderMaterial {
  return layer.resources.trackMaterial(
    new ShaderMaterial({
      transparent: true,
      depthTest: theme.vertices.depthTest && !theme.vertices.xray,
      depthWrite: false,
      vertexShader: `
        attribute float pointSize;
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_PointSize = pointSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z -= 0.0001 * gl_Position.w;
        }
      `,
      fragmentShader: style === "circle-sprite" ? `
        varying vec4 vColor;
        void main() {
          vec2 centered = gl_PointCoord - vec2(0.5);
          if (dot(centered, centered) > 0.25 || vColor.a <= 0.0) discard;
          gl_FragColor = vColor;
        }
      ` : `
        varying vec4 vColor;
        void main() {
          if (vColor.a <= 0.0) discard;
          gl_FragColor = vColor;
        }
      `,
    }),
  ) as ShaderMaterial;
}

function _spriteTexture(assets: VertexVisualizerAssets, kind: "square" | "circle"): CanvasTexture | undefined {
  if (assets.spriteTextures[kind]) {
    return assets.spriteTextures[kind];
  }
  if (typeof document === "undefined") {
    return undefined;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  if (kind === "circle") {
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(8, 8, 48, 48);
  }
  const texture = assets.trackRootTexture(new CanvasTexture(canvas));
  assets.spriteTextures[kind] = texture;
  return texture;
}

function makeVertexPointGeometry(layer: ObjectLayer): BufferGeometry {
  const geometry = layer.resources.trackGeometry(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(layer.vertexPositions, 3));
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(layer.vertices.size * 4), 4).setUsage(DynamicDrawUsage),
  );
  geometry.setAttribute(
    "pointSize",
    new BufferAttribute(new Float32Array(layer.vertices.size), 1).setUsage(DynamicDrawUsage),
  );
  return geometry;
}
