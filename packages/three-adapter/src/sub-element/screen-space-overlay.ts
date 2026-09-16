import { InstancedMesh, Matrix4, Points, PointsMaterial, Quaternion, Vector3 } from "three";
import { clampPixelSize, worldSizeForPixels } from "./screen-space";
import { hashView } from "./geometry-cache";
import type { ObjectLayer, OverlayMeshSource, VisualizerView } from "./visualizer-types";
import type { SubElementVisualTheme } from "./types";

const _matrix = new Matrix4();
const _scale = new Vector3();
const _from = new Vector3();
const _to = new Vector3();
const _dir = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();
const _mid = new Vector3();
const _camPos = new Vector3();
const _xAxis = new Vector3(1, 0, 0);

export function updateOverlayScreenSpace(
  layer: ObjectLayer,
  source: OverlayMeshSource,
  view: VisualizerView,
  theme: SubElementVisualTheme,
  force: boolean,
): "updated" | "skipped" {
  source.object.updateWorldMatrix(true, false);
  view.camera.updateMatrixWorld();
  const viewHash = hashView(view, source.object);
  if (!force && viewHash === layer.lastViewHash) {
    return "skipped";
  }
  layer.lastViewHash = viewHash;
  view.camera.getWorldPosition(_camPos);
  const camLike = view.camera as unknown as {
    isPerspectiveCamera?: boolean;
    isOrthographicCamera?: boolean;
    fov?: number;
    zoom?: number;
    top?: number;
    bottom?: number;
  };
  const vTheme = theme.vertices;
  const pixel = clampPixelSize(vTheme.pixelSize, vTheme.minPixelSize, vTheme.maxPixelSize);
  const pickPad = pixel + vTheme.pickPixelPadding;
  const visual = layer.vertexMesh;
  for (let i = 0; i < layer.vertices.size; i += 1) {
    const px = layer.vertexPositions[i * 3]!;
    const py = layer.vertexPositions[i * 3 + 1]!;
    const pz = layer.vertexPositions[i * 3 + 2]!;
    _pos.set(px, py, pz).applyMatrix4(source.object.matrixWorld);
    const dist = _pos.distanceTo(_camPos);
    const world = worldSizeForPixels(camLike, dist, pixel, view.height);
    const pick = worldSizeForPixels(camLike, dist, pickPad, view.height);
    if (visual instanceof InstancedMesh) {
      _matrix.makeScale(world, world, world);
      _matrix.setPosition(px, py, pz);
      visual.setMatrixAt(i, _matrix);
    }
    if (layer.vertexPick) {
      _matrix.makeScale(pick, pick, pick);
      _matrix.setPosition(px, py, pz);
      layer.vertexPick.setMatrixAt(i, _matrix);
    }
  }
  if (visual instanceof InstancedMesh) {
    visual.instanceMatrix.needsUpdate = true;
    visual.count = layer.vertices.size;
  }
  if (visual instanceof Points) {
    const mat = visual.material as PointsMaterial;
    mat.size = pixel;
  }
  if (layer.vertexPick) {
    layer.vertexPick.instanceMatrix.needsUpdate = true;
    layer.vertexPick.count = layer.vertices.size;
  }
  if (layer.edgeThick) {
    const widthPx = theme.edges.width;
    for (let i = 0; i < layer.edges.size; i += 1) {
      const o = i * 6;
      _from.set(layer.edgeEndpoints[o]!, layer.edgeEndpoints[o + 1]!, layer.edgeEndpoints[o + 2]!);
      _to.set(layer.edgeEndpoints[o + 3]!, layer.edgeEndpoints[o + 4]!, layer.edgeEndpoints[o + 5]!);
      _dir.subVectors(_to, _from);
      const length = _dir.length();
      if (length < 1e-10) {
        continue;
      }
      _dir.multiplyScalar(1 / length);
      _pos.copy(_from).add(_to).multiplyScalar(0.5);
      _pos.applyMatrix4(source.object.matrixWorld);
      const dist = _pos.distanceTo(_camPos);
      const thick = worldSizeForPixels(camLike, dist, widthPx, view.height);
      _mid.copy(_from).add(_to).multiplyScalar(0.5);
      _quat.setFromUnitVectors(_xAxis, _dir);
      _scale.set(Math.max(length, 1e-6), thick, thick);
      _matrix.compose(_mid, _quat, _scale);
      layer.edgeThick.setMatrixAt(i, _matrix);
    }
    layer.edgeThick.instanceMatrix.needsUpdate = true;
    layer.edgeThick.count = layer.edges.size;
  }
  return "updated";
}
