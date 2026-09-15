import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { dropUnusedEdge, findEdge, repairVertexHalfEdges } from "../internal/rebuild";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";

export interface AddVertexRequest {
  readonly position: readonly [number, number, number];
}

export interface AddVertexResult extends MeshOperationResult {
  readonly vertexId: VertexId;
}

export interface AddEdgeRequest {
  readonly a: VertexId;
  readonly b: VertexId;
}

export interface AddEdgeResult extends MeshOperationResult {
  readonly edgeId: EdgeId;
}

export interface AddFaceRequest {
  readonly vertexIds: readonly VertexId[];
  readonly materialSlot?: number;
}

export interface AddFaceResult extends MeshOperationResult {
  readonly faceId: FaceId;
}

export interface DeleteFacesRequest {
  readonly faceIds: readonly FaceId[];
}

export interface DeleteEdgesRequest {
  readonly edgeIds: readonly EdgeId[];
}

export interface DeleteVerticesRequest {
  readonly vertexIds: readonly VertexId[];
}

function finish(
  mesh: HalfEdgeMesh,
  mapping: TopologyMappingBuilder,
  selection: MeshOperationResult["selection"],
): Pick<MeshOperationResult, "mesh" | "changes" | "mapping" | "selection" | "warnings"> {
  repairVertexHalfEdges(mesh);
  const built = mapping.build(mesh);
  return { mesh, ...built, selection, warnings: [] };
}

export function addVertex(
  mesh: HalfEdgeMesh,
  request: AddVertexRequest,
  ctx: MeshOperationContext,
): AddVertexResult {
  const [x, y, z] = request.position;
  if (![x, y, z].every(Number.isFinite)) {
    throw new RangeError("addVertex requires finite coordinates");
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const vertexId = ctx.idFactory.vertex();
  MeshBuilder.fromMesh(mesh).addVertex(x, y, z, vertexId);
  mapping.createVertex(vertexId);
  return {
    ...finish(mesh, mapping, { domain: "vertex", elementIds: [vertexId] }),
    vertexId,
  };
}

export function addEdge(
  mesh: HalfEdgeMesh,
  request: AddEdgeRequest,
  ctx: MeshOperationContext,
): AddEdgeResult {
  const { a, b } = request;
  if (a === b) {
    throw new RangeError("addEdge requires two distinct vertices");
  }
  if (!mesh.vertices.has(a) || !mesh.vertices.has(b)) {
    throw new RangeError("addEdge vertices must exist");
  }
  if (findEdge(mesh, a, b)) {
    throw new RangeError("addEdge rejects a duplicate edge");
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const edgeId = ctx.idFactory.edge();
  const heA = ctx.idFactory.halfEdge();
  const heB = ctx.idFactory.halfEdge();
  mesh.edges.set(edgeId, { id: edgeId, halfEdge: heA, isSeam: false });
  mesh.halfEdges.set(heA, {
    id: heA,
    edgeId,
    origin: a,
    twin: heB,
    next: heB,
    prev: heB,
    face: null,
    corner: null,
  });
  mesh.halfEdges.set(heB, {
    id: heB,
    edgeId,
    origin: b,
    twin: heA,
    next: heA,
    prev: heA,
    face: null,
    corner: null,
  });
  const va = mesh.vertices.get(a)!;
  const vb = mesh.vertices.get(b)!;
  if (!va.halfEdge) {
    va.halfEdge = heA;
  }
  if (!vb.halfEdge) {
    vb.halfEdge = heB;
  }
  mesh.bumpRevision();
  mapping.createEdge(edgeId);
  return {
    ...finish(mesh, mapping, { domain: "edge", elementIds: [edgeId] }),
    edgeId,
  };
}

export function addFace(
  mesh: HalfEdgeMesh,
  request: AddFaceRequest,
  ctx: MeshOperationContext,
): AddFaceResult {
  const { vertexIds } = request;
  if (vertexIds.length < 3) {
    throw new RangeError("addFace requires at least 3 vertices");
  }
  for (let i = 0; i < vertexIds.length; i++) {
    const id = vertexIds[i]!;
    if (!mesh.vertices.has(id)) {
      throw new RangeError(`addFace vertex ${id} does not exist`);
    }
    if (id === vertexIds[(i + 1) % vertexIds.length]) {
      throw new RangeError("addFace rejects consecutive duplicate vertices");
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const faceId = ctx.idFactory.face();
  const newEdgePairs: [VertexId, VertexId][] = [];
  for (let i = 0; i < vertexIds.length; i++) {
    const vFrom = vertexIds[i]!;
    const vTo = vertexIds[(i + 1) % vertexIds.length]!;
    if (!findEdge(mesh, vFrom, vTo)) {
      newEdgePairs.push([vFrom, vTo]);
    }
  }
  MeshBuilder.fromMesh(mesh).addFace(vertexIds, {
    id: faceId,
    materialSlot: request.materialSlot ?? 0,
  });
  mapping.createFace(faceId);
  for (const cornerId of mesh.getFaceCorners(faceId)) {
    mapping.createCorner(cornerId);
  }
  for (const [vFrom, vTo] of newEdgePairs) {
    const eId = findEdge(mesh, vFrom, vTo);
    if (eId) {
      mapping.createEdge(eId);
    }
  }
  return {
    ...finish(mesh, mapping, { domain: "face", elementIds: [faceId] }),
    faceId,
  };
}

export function deleteFaces(
  mesh: HalfEdgeMesh,
  request: DeleteFacesRequest,
  _ctx: MeshOperationContext,
): MeshOperationResult {
  const unique = [...new Set(request.faceIds)];
  if (unique.length === 0) {
    const mapping = new TopologyMappingBuilder(mesh);
    return finish(mesh, mapping, { domain: "face", elementIds: [] });
  }
  for (const faceId of unique) {
    if (!mesh.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const candidateEdges = new Set<EdgeId>();
  for (const faceId of unique) {
    for (const edgeId of mesh.getFaceEdges(faceId)) {
      candidateEdges.add(edgeId);
    }
    for (const cornerId of mesh.getFaceCorners(faceId)) {
      mapping.deleteCorner(cornerId);
    }
    mapping.deleteFace(faceId);
  }
  for (const faceId of unique) {
    deleteFace(mesh, faceId);
  }
  for (const edgeId of candidateEdges) {
    if (!mesh.edges.has(edgeId)) {
      mapping.deleteEdge(edgeId);
    }
  }
  return finish(mesh, mapping, { domain: "face", elementIds: [] });
}

export function deleteEdges(
  mesh: HalfEdgeMesh,
  request: DeleteEdgesRequest,
  _ctx: MeshOperationContext,
): MeshOperationResult {
  const unique = [...new Set(request.edgeIds)];
  if (unique.length === 0) {
    const mapping = new TopologyMappingBuilder(mesh);
    return finish(mesh, mapping, { domain: "edge", elementIds: [] });
  }
  for (const edgeId of unique) {
    if (!mesh.edges.has(edgeId)) {
      throw new RangeError(`Edge ${edgeId} does not exist`);
    }
  }
  const faces = new Set<FaceId>();
  for (const edgeId of unique) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (f1) {
      faces.add(f1);
    }
    if (f2) {
      faces.add(f2);
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  if (faces.size > 0) {
    const candidateEdges = new Set<EdgeId>();
    for (const faceId of faces) {
      for (const edgeId of mesh.getFaceEdges(faceId)) {
        candidateEdges.add(edgeId);
      }
      for (const cornerId of mesh.getFaceCorners(faceId)) {
        mapping.deleteCorner(cornerId);
      }
      mapping.deleteFace(faceId);
    }
    for (const faceId of faces) {
      deleteFace(mesh, faceId);
    }
    for (const edgeId of candidateEdges) {
      if (!mesh.edges.has(edgeId)) {
        mapping.deleteEdge(edgeId);
      }
    }
  }
  for (const edgeId of unique) {
    if (mesh.edges.has(edgeId)) {
      dropUnusedEdge(mesh, edgeId);
      if (!mesh.edges.has(edgeId)) {
        mapping.deleteEdge(edgeId);
      }
    }
  }
  mesh.bumpRevision();
  return finish(mesh, mapping, { domain: "edge", elementIds: [] });
}

export function deleteVertices(
  mesh: HalfEdgeMesh,
  request: DeleteVerticesRequest,
  _ctx: MeshOperationContext,
): MeshOperationResult {
  const unique = [...new Set(request.vertexIds)];
  for (const vertexId of unique) {
    if (!mesh.vertices.has(vertexId)) {
      throw new RangeError(`Vertex ${vertexId} does not exist`);
    }
  }
  const faces = new Set<FaceId>();
  for (const vertexId of unique) {
    for (const faceId of mesh.getVertexFaces(vertexId)) {
      faces.add(faceId);
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  if (faces.size > 0) {
    const candidateEdges = new Set<EdgeId>();
    for (const faceId of faces) {
      for (const edgeId of mesh.getFaceEdges(faceId)) {
        candidateEdges.add(edgeId);
      }
      for (const cornerId of mesh.getFaceCorners(faceId)) {
        mapping.deleteCorner(cornerId);
      }
      mapping.deleteFace(faceId);
    }
    for (const faceId of faces) {
      deleteFace(mesh, faceId);
    }
    for (const edgeId of candidateEdges) {
      if (!mesh.edges.has(edgeId)) {
        mapping.deleteEdge(edgeId);
      }
    }
  }
  for (const vertexId of unique) {
    for (const edgeId of [...mesh.getVertexEdges(vertexId)]) {
      const [f1, f2] = mesh.getEdgeFaces(edgeId);
      if (!f1 && !f2) {
        dropUnusedEdge(mesh, edgeId);
        if (!mesh.edges.has(edgeId)) {
          mapping.deleteEdge(edgeId);
        }
      }
    }
    mesh.vertices.delete(vertexId);
    mapping.deleteVertex(vertexId);
  }
  mesh.bumpRevision();
  return finish(mesh, mapping, { domain: "vertex", elementIds: [] });
}
