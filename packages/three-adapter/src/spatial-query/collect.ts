import { Box3, Mesh } from "three";
import type { TrackedObject } from "../adapter-types";
import type { SpatialAabb } from "./types";

const worldBox = new Box3();

export function collectSpatialPrimitives(
  tracked: ReadonlyMap<string, TrackedObject>,
): SpatialAabb[] {
  const primitives: SpatialAabb[] = [];
  for (const [objectId, handle] of tracked) {
    const object = handle.object;
    if (!(object instanceof Mesh) || !object.visible || object.userData.isOverlay) {
      continue;
    }
    const geometry = object.geometry;
    if (!geometry) {
      continue;
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const local = geometry.boundingBox;
    if (!local || local.isEmpty()) {
      continue;
    }
    object.updateWorldMatrix(true, false);
    worldBox.copy(local).applyMatrix4(object.matrixWorld);
    if (worldBox.isEmpty()) {
      continue;
    }
    primitives.push({
      objectId,
      min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
      max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
      topologyRevision: handle.topologyRevision ?? 0,
      positionsRevision: handle.positionsRevision ?? 0,
    });
  }
  return primitives;
}
