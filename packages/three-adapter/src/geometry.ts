import type { FaceId, VertexId } from "@modeling-kit/core";
import { triangulateMesh, type HalfEdgeMesh, type TriangulatedMesh } from "@modeling-kit/mesh";
import { BufferAttribute, BufferGeometry } from "three";

export interface RenderMapping {
  readonly triangleToFace: readonly FaceId[];
  readonly renderVertexToVertex: readonly VertexId[];
}

export function createBufferGeometry(mesh: HalfEdgeMesh): {
  geometry: BufferGeometry;
  mapping: RenderMapping;
} {
  return syncDerivedGeometry(mesh);
}

/** Updates derived GPU buffers. Reuses the existing geometry when topology is unchanged. */
export function syncDerivedGeometry(
  mesh: HalfEdgeMesh,
  previous?: { geometry: BufferGeometry; mapping: RenderMapping },
): { geometry: BufferGeometry; mapping: RenderMapping; reused: boolean } {
  const tri = triangulateMesh(mesh);
  if (previous && canReuseDerived(previous.geometry, previous.mapping, tri)) {
    copyAttribute(previous.geometry, "position", tri.positions, 3);
    copyAttribute(previous.geometry, "normal", tri.normals, 3);
    copyAttribute(previous.geometry, "uv", tri.uvs, 2);
    previous.geometry.computeBoundingSphere();
    previous.geometry.computeBoundingBox();
    return { geometry: previous.geometry, mapping: previous.mapping, reused: true };
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(tri.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(tri.normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(tri.uvs, 2));
  geometry.setIndex(new BufferAttribute(tri.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mapping: RenderMapping = {
    triangleToFace: tri.triangleFaceIds,
    renderVertexToVertex: tri.vertexIdMap,
  };
  geometry.userData.mapping = mapping;
  return { geometry, mapping, reused: false };
}

function canReuseDerived(
  geometry: BufferGeometry,
  mapping: RenderMapping,
  tri: TriangulatedMesh,
): boolean {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!position || position.count !== tri.positions.length / 3) {
    return false;
  }
  if (!index || index.count !== tri.indices.length) {
    return false;
  }
  if (mapping.triangleToFace.length !== tri.triangleFaceIds.length) {
    return false;
  }
  if (mapping.renderVertexToVertex.length !== tri.vertexIdMap.length) {
    return false;
  }
  for (let i = 0; i < mapping.triangleToFace.length; i += 1) {
    if (mapping.triangleToFace[i] !== tri.triangleFaceIds[i]) {
      return false;
    }
  }
  for (let i = 0; i < mapping.renderVertexToVertex.length; i += 1) {
    if (mapping.renderVertexToVertex[i] !== tri.vertexIdMap[i]) {
      return false;
    }
  }
  return true;
}

function copyAttribute(
  geometry: BufferGeometry,
  name: string,
  values: Float32Array,
  itemSize: number,
): void {
  const attribute = geometry.getAttribute(name) as BufferAttribute | undefined;
  if (!attribute || attribute.array.length !== values.length) {
    geometry.setAttribute(name, new BufferAttribute(values, itemSize));
    return;
  }
  (attribute.array as Float32Array).set(values);
  attribute.needsUpdate = true;
}
