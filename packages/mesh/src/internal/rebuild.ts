import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder, type AddFaceOptions } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import type { FaceRecord } from "../types";
import { deleteFace } from "./delete-face";

export interface FaceRebuildPlan {
  readonly faceId: FaceId;
  readonly vertices: VertexId[];
  readonly materialSlot: number;
  readonly materialSlotId?: FaceRecord["materialSlotId"];
  readonly isSmooth: boolean;
  readonly uvs?: [number, number][];
  readonly uvChannels?: Readonly<Record<string, [number, number]>>[];
  readonly pinnedUvChannels?: readonly (readonly import("@modeling-kit/core").UVChannelId[])[];
  readonly normals?: [number, number, number][];
  readonly colors?: [number, number, number, number][];
}

export function rebuildFaces(mesh: HalfEdgeMesh, plans: readonly FaceRebuildPlan[]): void {
  for (const plan of plans) {
    deleteFace(mesh, plan.faceId);
  }
  const builder = MeshBuilder.fromMesh(mesh);
  for (const plan of plans) {
    const options: AddFaceOptions = {
      id: plan.faceId,
      materialSlot: plan.materialSlot,
      materialSlotId: plan.materialSlotId,
      isSmooth: plan.isSmooth,
      ...(plan.uvs ? { uvs: plan.uvs } : {}),
      ...(plan.uvChannels ? { uvChannels: plan.uvChannels } : {}),
      ...(plan.pinnedUvChannels ? { pinnedUvChannels: plan.pinnedUvChannels } : {}),
      ...(plan.normals ? { normals: plan.normals } : {}),
      ...(plan.colors ? { colors: plan.colors } : {}),
    };
    builder.addFace(plan.vertices, options);
  }
  repairVertexHalfEdges(mesh);
}

export function repairVertexHalfEdges(mesh: HalfEdgeMesh): void {
  for (const vertex of mesh.vertices.values()) {
    if (vertex.halfEdge && !mesh.halfEdges.has(vertex.halfEdge)) {
      vertex.halfEdge = null;
    }
  }
  for (const he of mesh.halfEdges.values()) {
    const vertex = mesh.vertices.get(he.origin);
    if (vertex && !vertex.halfEdge) {
      vertex.halfEdge = he.id;
    }
  }
}

export function requireEdge(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): EdgeId {
  for (const [edgeId] of mesh.edges) {
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    if ((ends[0] === a && ends[1] === b) || (ends[0] === b && ends[1] === a)) {
      return edgeId;
    }
  }
  throw new RangeError(`Expected an edge between ${a} and ${b}`);
}

export function dropUnusedEdge(mesh: HalfEdgeMesh, edgeId: EdgeId): void {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    return;
  }
  const [f1, f2] = mesh.getEdgeFaces(edgeId);
  if (f1 || f2) {
    return;
  }
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (he) {
    if (he.twin) {
      mesh.halfEdges.delete(he.twin);
    }
    mesh.halfEdges.delete(he.id);
  }
  mesh.edges.delete(edgeId);
}

export function findEdge(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): EdgeId | null {
  for (const [edgeId] of mesh.edges) {
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    if ((ends[0] === a && ends[1] === b) || (ends[0] === b && ends[1] === a)) {
      return edgeId;
    }
  }
  return null;
}
