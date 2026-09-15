import type { FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace, faceNormal } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import {
  createMeshOperationContext,
  type MeshOperationContext,
  type MeshOperationResult,
} from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface ExtrudeFacesRequest {
  readonly faceIds: readonly FaceId[];
  readonly distance: number;
}

export interface ExtrudeFacesResult {
  readonly capFaceIds: FaceId[];
  readonly sideFaceIds: FaceId[];
  readonly vertexMap: ReadonlyMap<VertexId, VertexId>;
}

export interface ExtrudeFacesOpResult extends MeshOperationResult, ExtrudeFacesResult {}

export function extrudeFaces(
  mesh: HalfEdgeMesh,
  request: ExtrudeFacesRequest,
  ctx: MeshOperationContext,
): ExtrudeFacesOpResult;
export function extrudeFaces(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  distance: number,
  ids: IdFactory,
): ExtrudeFacesResult;
export function extrudeFaces(
  mesh: HalfEdgeMesh,
  requestOrIds: ExtrudeFacesRequest | readonly FaceId[],
  ctxOrDistance: MeshOperationContext | number,
  ids?: IdFactory,
): ExtrudeFacesOpResult | ExtrudeFacesResult {
  if (typeof ctxOrDistance === "number") {
    if (!ids) {
      throw new RangeError("extrudeFaces requires an IdFactory");
    }
    return extrudeFaces(mesh, { faceIds: requestOrIds as readonly FaceId[], distance: ctxOrDistance }, createMeshOperationContext(ids));
  }
  return extrudeFacesOp(mesh, requestOrIds as ExtrudeFacesRequest, ctxOrDistance);
}

function extrudeFacesOp(
  mesh: HalfEdgeMesh,
  request: ExtrudeFacesRequest,
  ctx: MeshOperationContext,
): ExtrudeFacesOpResult {
  return runTransactionalMeshOp(mesh, () => {
  const { faceIds, distance } = request;
  if (faceIds.length === 0) {
    throw new RangeError("extrudeFaces requires at least one face");
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const capFaceIds: FaceId[] = [];
  const sideFaceIds: FaceId[] = [];
  const vertexMap = new Map<VertexId, VertexId>();

  for (const faceId of faceIds) {
    if (!mesh.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
    const loop = mesh.getFaceVertices(faceId);
    const normal = faceNormal(mesh, faceId);
    const offset = normal.scale(distance);
    let builder = MeshBuilder.fromMesh(mesh);
    const newLoop: VertexId[] = [];
    for (const vertexId of loop) {
      let mapped = vertexMap.get(vertexId);
      if (!mapped) {
        const src = mesh.vertices.get(vertexId)!;
        mapped = builder.addVertex(
          src.position[0] + offset.x,
          src.position[1] + offset.y,
          src.position[2] + offset.z,
          ctx.idFactory.vertex(),
        );
        vertexMap.set(vertexId, mapped);
        mapping.createVertex(mapped, [vertexId]);
      }
      newLoop.push(mapped);
    }
    deleteFace(mesh, faceId);
    mapping.deleteFace(faceId);
    builder = MeshBuilder.fromMesh(mesh);
    const capId = builder.addFace(newLoop, { id: ctx.idFactory.face() });
    mapping.createFace(capId, [faceId]);
    mapping.replaceFace(faceId, [capId]);
    capFaceIds.push(capId);
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const na = newLoop[i]!;
      const nb = newLoop[(i + 1) % loop.length]!;
      const sideId = builder.addFace([a, b, nb, na], { id: ctx.idFactory.face() });
      mapping.createFace(sideId, [faceId]);
      sideFaceIds.push(sideId);
    }
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: capFaceIds },
    warnings: [],
    capFaceIds,
    sideFaceIds,
    vertexMap,
  };
  });
}
