import type { ModelingSession } from "@modeling-kit/commands";
import { getEffectiveSelectable, getEffectiveVisibility, isMeshLikeNode } from "@modeling-kit/document";
import type { MeshId, ObjectId } from "@modeling-kit/core";
import { Mesh, type Camera, type Object3D } from "three";
import type { GpuPickDrawable } from "./gpu-picking";
import type { TrackedObject } from "./adapter-types";

export function collectPickDrawables(
  tracked: ReadonlyMap<ObjectId, TrackedObject>,
  session: ModelingSession,
  camera: Camera,
  root: Object3D,
): GpuPickDrawable[] {
  root.updateMatrixWorld(true);
  const drawables: GpuPickDrawable[] = [];
  for (const [objectId, item] of tracked) {
    if (!(item.object instanceof Mesh) || !item.geometry || !item.mapping) {
      continue;
    }
    if (item.object.userData.isOverlay) {
      continue;
    }
    if (item.object.type === "InstancedMesh") {
      continue;
    }
    if (!camera.layers.test(item.object.layers)) {
      continue;
    }
    const node = session.document.scene.nodes.get(objectId);
    if (!node || !isMeshLikeNode(node)) {
      continue;
    }
    const meshId = item.object.userData.meshId as MeshId | undefined;
    drawables.push({
      objectId,
      ...(meshId ? { meshId } : {}),
      visible: getEffectiveVisibility(session.document, objectId) && item.object.visible,
      selectable: getEffectiveSelectable(session.document, objectId),
      object: item.object,
      geometry: item.geometry,
      mapping: item.mapping,
      matrixWorld: item.object.matrixWorld,
      geometryRevision: item.meshRevision ?? 0,
    });
  }
  return drawables;
}
