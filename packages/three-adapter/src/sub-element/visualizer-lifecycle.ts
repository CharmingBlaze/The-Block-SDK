import type { ObjectLayer } from "./visualizer-types";

export function clearLayerMeshes(layer: ObjectLayer): void {
  const meshes = [layer.vertexMesh, layer.vertexPick, layer.edgeLines, layer.edgeThick, layer.faceFill, layer.faceOutline];
  for (const mesh of meshes) {
    mesh?.removeFromParent();
  }
  delete layer.vertexMesh;
  delete layer.vertexPick;
  delete layer.edgeLines;
  delete layer.edgeThick;
  delete layer.faceFill;
  delete layer.faceOutline;
}

export function disposeObjectLayer(layer: ObjectLayer): void {
  clearLayerMeshes(layer);
  layer.resources.dispose();
  layer.group.removeFromParent();
}
