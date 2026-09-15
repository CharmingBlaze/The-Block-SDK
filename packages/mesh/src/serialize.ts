import type { MeshId } from "@modeling-kit/core";
import { HalfEdgeMesh } from "./half-edge-mesh";
import type { CornerRecord, EdgeRecord, FaceRecord, HalfEdgeRecord, VertexRecord } from "./types";

export interface SerializedMesh {
  readonly id: MeshId;
  readonly revision: number;
  readonly topologyRevision?: number;
  readonly positionsRevision?: number;
  readonly normalsRevision?: number;
  readonly uvRevision?: number;
  readonly seamRevision?: number;
  readonly pinRevision?: number;
  readonly materialsRevision?: number;
  readonly vertices: VertexRecord[];
  readonly edges: EdgeRecord[];
  readonly halfEdges: HalfEdgeRecord[];
  readonly corners: CornerRecord[];
  readonly faces: FaceRecord[];
}

function cloneVertex(record: VertexRecord): VertexRecord {
  return { ...record, position: [record.position[0], record.position[1], record.position[2]] };
}

function cloneCorner(record: CornerRecord): CornerRecord {
  const uvChannels = record.uvChannels
    ? Object.fromEntries(
        Object.entries(record.uvChannels).map(([key, uv]) => [key, [uv[0], uv[1]] as [number, number]]),
      )
    : undefined;
  return {
    ...record,
    ...(record.uv ? { uv: [record.uv[0], record.uv[1]] as [number, number] } : {}),
    ...(uvChannels ? { uvChannels } : {}),
    ...(record.pinnedUvChannels ? { pinnedUvChannels: [...record.pinnedUvChannels] } : {}),
    ...(record.normal
      ? {
          normal: [record.normal[0], record.normal[1], record.normal[2]] as [
            number,
            number,
            number,
          ],
        }
      : {}),
    ...(record.color
      ? {
          color: [record.color[0], record.color[1], record.color[2], record.color[3]] as [
            number,
            number,
            number,
            number,
          ],
        }
      : {}),
  };
}

export function serializeMesh(mesh: HalfEdgeMesh): SerializedMesh {
  return {
    id: mesh.id,
    revision: mesh.revision,
    topologyRevision: mesh.topologyRevision,
    positionsRevision: mesh.positionsRevision,
    normalsRevision: mesh.normalsRevision,
    uvRevision: mesh.uvRevision,
    seamRevision: mesh.seamRevision,
    pinRevision: mesh.pinRevision,
    materialsRevision: mesh.materialsRevision,
    vertices: [...mesh.vertices.values()].map(cloneVertex),
    edges: [...mesh.edges.values()].map((record) => ({
      ...record,
      ...(record.seamChannels ? { seamChannels: [...record.seamChannels] } : {}),
    })),
    halfEdges: [...mesh.halfEdges.values()].map((record) => ({ ...record })),
    corners: [...mesh.corners.values()].map(cloneCorner),
    faces: [...mesh.faces.values()].map((record) => ({ ...record })),
  };
}

export function deserializeMesh(data: SerializedMesh): HalfEdgeMesh {
  const mesh = new HalfEdgeMesh(data.id);
  restoreMesh(mesh, data);
  return mesh;
}

export function restoreMesh(mesh: HalfEdgeMesh, data: SerializedMesh): void {
  mesh.vertices.clear();
  mesh.edges.clear();
  mesh.halfEdges.clear();
  mesh.corners.clear();
  mesh.faces.clear();
  for (const record of data.vertices) {
    mesh.vertices.set(record.id, cloneVertex(record));
  }
  for (const record of data.edges) {
    mesh.edges.set(record.id, { ...record });
  }
  for (const record of data.halfEdges) {
    mesh.halfEdges.set(record.id, { ...record });
  }
  for (const record of data.corners) {
    mesh.corners.set(record.id, cloneCorner(record));
  }
  for (const record of data.faces) {
    mesh.faces.set(record.id, { ...record });
  }
  mesh.setRevisions({
    revision: data.revision,
    topology: data.topologyRevision ?? data.revision,
    positions: data.positionsRevision ?? 0,
    normals: data.normalsRevision ?? 0,
    uv: data.uvRevision ?? 0,
    seams: data.seamRevision ?? 0,
    pins: data.pinRevision ?? 0,
    materials: data.materialsRevision ?? 0,
  });
}

export function cloneMesh(mesh: HalfEdgeMesh): HalfEdgeMesh {
  return deserializeMesh(serializeMesh(mesh));
}

export function meshFingerprint(mesh: HalfEdgeMesh): string {
  return JSON.stringify(serializeMesh(mesh));
}
