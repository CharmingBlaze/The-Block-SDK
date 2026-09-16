import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import { faceNormal, triangulateMesh, type HalfEdgeMesh, type TriangulatedMesh } from "@modeling-kit/mesh";
import { BufferAttribute, BufferGeometry } from "three";

export interface RenderMapping {
  readonly triangleToFace: readonly FaceId[];
  readonly renderVertexToVertex: readonly VertexId[];
  readonly renderVertexToCorner: readonly CornerId[];
}

export function createBufferGeometry(mesh: HalfEdgeMesh): {
  geometry: BufferGeometry;
  mapping: RenderMapping;
} {
  return syncDerivedGeometry(mesh);
}

export interface DerivedGeometryPrevious {
  geometry: BufferGeometry;
  mapping: RenderMapping;
  topologyRevision?: number;
}

/** Updates derived GPU buffers. Reuses the existing geometry when topology is unchanged. */
export function syncDerivedGeometry(
  mesh: HalfEdgeMesh,
  previous?: DerivedGeometryPrevious,
): { geometry: BufferGeometry; mapping: RenderMapping; reused: boolean; triangulated?: TriangulatedMesh } {
  if (previous && canRefitWithoutTessellation(mesh, previous)) {
    refitDerivedFromKernel(mesh, previous.geometry, previous.mapping);
    return { geometry: previous.geometry, mapping: previous.mapping, reused: true };
  }
  const tri = triangulateMesh(mesh);
  if (previous && canReuseDerived(previous.geometry, previous.mapping, tri)) {
    copyAttribute(previous.geometry, "position", tri.positions, 3);
    copyAttribute(previous.geometry, "normal", tri.normals, 3);
    copyAttribute(previous.geometry, "uv", tri.uvs, 2);
    previous.geometry.computeBoundingSphere();
    previous.geometry.computeBoundingBox();
    return { geometry: previous.geometry, mapping: previous.mapping, reused: true, triangulated: tri };
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
    renderVertexToCorner: tri.cornerIdMap,
  };
  geometry.userData.mapping = mapping;
  return { geometry, mapping, reused: false, triangulated: tri };
}

function canRefitWithoutTessellation(mesh: HalfEdgeMesh, previous: DerivedGeometryPrevious): boolean {
  if (previous.topologyRevision === undefined || previous.topologyRevision !== mesh.topologyRevision) {
    return false;
  }
  const position = previous.geometry.getAttribute("position");
  return Boolean(position && position.count === previous.mapping.renderVertexToVertex.length);
}

function refitDerivedFromKernel(
  mesh: HalfEdgeMesh,
  geometry: BufferGeometry,
  mapping: RenderMapping,
): void {
  const count = mapping.renderVertexToVertex.length;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const faceNormals = new Map<FaceId, readonly [number, number, number]>();

  for (let i = 0; i < count; i += 1) {
    const vertex = mesh.vertices.get(mapping.renderVertexToVertex[i]!);
    if (vertex) {
      const base = i * 3;
      positions[base] = vertex.position[0];
      positions[base + 1] = vertex.position[1];
      positions[base + 2] = vertex.position[2];
    }
    const corner = mesh.corners.get(mapping.renderVertexToCorner[i]!);
    const uv = corner?.uv ?? [0, 0];
    uvs[i * 2] = uv[0];
    uvs[i * 2 + 1] = uv[1];
    let normal: readonly [number, number, number] | undefined = corner?.normal;
    if (!normal && corner) {
      let cached = faceNormals.get(corner.faceId);
      if (!cached) {
        const computed = faceNormal(mesh, corner.faceId);
        cached = [computed.x, computed.y, computed.z];
        faceNormals.set(corner.faceId, cached);
      }
      normal = cached;
    }
    if (normal) {
      const base = i * 3;
      normals[base] = normal[0];
      normals[base + 1] = normal[1];
      normals[base + 2] = normal[2];
    }
  }

  copyAttribute(geometry, "position", positions, 3);
  copyAttribute(geometry, "normal", normals, 3);
  copyAttribute(geometry, "uv", uvs, 2);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
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
  if (mapping.renderVertexToCorner.length !== tri.cornerIdMap.length) {
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
  for (let i = 0; i < mapping.renderVertexToCorner.length; i += 1) {
    if (mapping.renderVertexToCorner[i] !== tri.cornerIdMap[i]) {
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
