import type { ModelingSession } from "@modeling-kit/commands";
import type { MeshRecord } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { skeletonFromData, skinFromBinding, skinPositions } from "@modeling-kit/rigging";
import type { BufferGeometry } from "three";
import type { RenderMapping } from "./geometry";

export function applyCpuSkin(
  session: ModelingSession,
  record: MeshRecord,
  kernel: HalfEdgeMesh,
  geometry: BufferGeometry,
  mapping: RenderMapping,
): void {
  if (!record.skin) {
    return;
  }
  const skeletonData = session.document.skeletons.get(record.skin.skeletonId);
  if (!skeletonData) {
    return;
  }
  const skeleton = skeletonFromData(skeletonData);
  const skin = skinFromBinding(record.skin);
  const posed = skinPositions(kernel, skeleton, skin, session.poseLocals);
  const attr = geometry.getAttribute("position");
  if (!attr) {
    return;
  }
  for (let i = 0; i < mapping.renderVertexToVertex.length; i++) {
    const vertexId = mapping.renderVertexToVertex[i]!;
    const p = posed.get(vertexId);
    if (!p) {
      continue;
    }
    attr.setXYZ(i, p.x, p.y, p.z);
  }
  attr.needsUpdate = true;
}
