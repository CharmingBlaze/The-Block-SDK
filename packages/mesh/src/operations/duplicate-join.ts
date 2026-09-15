import type { FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { deleteFaces } from "./elements";
import type { MeshOperationContext, MeshOperationResult } from "./contract";

export interface DuplicateFacesRequest {
  readonly faceIds: readonly FaceId[];
}

export interface DuplicateFacesResult extends MeshOperationResult {
  readonly createdFaceIds: readonly FaceId[];
}

export interface SeparateFacesRequest {
  readonly faceIds: readonly FaceId[];
}

export interface SeparateFacesResult extends MeshOperationResult {
  readonly createdFaceIds: readonly FaceId[];
}

export interface JoinMeshesRequest {
  readonly source: HalfEdgeMesh;
}

export interface JoinMeshesResult extends MeshOperationResult {
  readonly createdFaceIds: readonly FaceId[];
}

function copyFacesFrom(
  target: HalfEdgeMesh,
  source: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  ctx: MeshOperationContext,
  mapping: TopologyMappingBuilder,
): FaceId[] {
  const unique = [...new Set(faceIds)];
  if (unique.length === 0) {
    return [];
  }
  for (const faceId of unique) {
    if (!source.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
  }
  const vertexMap = new Map<VertexId, VertexId>();
  let builder = MeshBuilder.fromMesh(target);
  const created: FaceId[] = [];
  for (const faceId of unique) {
    const loop = source.getFaceVertices(faceId);
    const face = source.faces.get(faceId)!;
    const corners = source.getFaceCorners(faceId);
    for (const vertexId of loop) {
      if (vertexMap.has(vertexId)) {
        continue;
      }
      const position = source.vertices.get(vertexId)!.position;
      const nextId = ctx.idFactory.vertex();
      builder.addVertex(position[0], position[1], position[2], nextId);
      mapping.createVertex(nextId, [vertexId]);
      vertexMap.set(vertexId, nextId);
    }
    const newLoop = loop.map((id) => vertexMap.get(id)!);
    const uvs = corners.map((id) => source.corners.get(id)?.uv);
    const colors = corners.map((id) => source.corners.get(id)?.color);
    const hasUvs = uvs.every((uv) => Array.isArray(uv));
    const hasColors = colors.every((color) => Array.isArray(color));
    const newFaceId = builder.addFace(newLoop, {
      id: ctx.idFactory.face(),
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
      ...(hasUvs ? { uvs: uvs as [number, number][] } : {}),
      ...(hasColors ? { colors: colors as [number, number, number, number][] } : {}),
    });
    mapping.createFace(newFaceId, [faceId]);
    created.push(newFaceId);
    builder = MeshBuilder.fromMesh(target);
  }
  return created;
}

export function duplicateFaces(
  mesh: HalfEdgeMesh,
  request: DuplicateFacesRequest,
  ctx: MeshOperationContext,
): DuplicateFacesResult {
  const mapping = new TopologyMappingBuilder(mesh);
  const createdFaceIds = copyFacesFrom(mesh, mesh, request.faceIds, ctx, mapping);
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: { domain: "face", elementIds: createdFaceIds },
    warnings: [],
    createdFaceIds,
  };
}

export function separateFaces(
  mesh: HalfEdgeMesh,
  request: SeparateFacesRequest,
  ctx: MeshOperationContext,
): SeparateFacesResult {
  const originals = [...new Set(request.faceIds)];
  const duplicated = duplicateFaces(mesh, { faceIds: originals }, ctx);
  if (originals.length > 0) {
    deleteFaces(mesh, { faceIds: originals }, ctx);
  }
  return {
    mesh,
    changes: {
      vertexCountDelta: duplicated.changes.vertexCountDelta,
      edgeCountDelta: duplicated.changes.edgeCountDelta,
      faceCountDelta: duplicated.changes.faceCountDelta,
      cornerCountDelta: duplicated.changes.cornerCountDelta,
    },
    mapping: duplicated.mapping,
    selection: { domain: "face", elementIds: duplicated.createdFaceIds },
    warnings: duplicated.warnings,
    createdFaceIds: duplicated.createdFaceIds,
  };
}

export function joinMeshes(
  mesh: HalfEdgeMesh,
  request: JoinMeshesRequest,
  ctx: MeshOperationContext,
): JoinMeshesResult {
  const mapping = new TopologyMappingBuilder(mesh);
  const createdFaceIds = copyFacesFrom(mesh, request.source, [...request.source.faces.keys()], ctx, mapping);
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: { domain: "face", elementIds: createdFaceIds },
    warnings: [],
    createdFaceIds,
  };
}
