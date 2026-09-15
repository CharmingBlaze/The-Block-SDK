import type { FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface TriangulateFacesRequest {
  readonly faceIds?: readonly FaceId[];
}

export interface TriangulateFacesResult extends MeshOperationResult {
  readonly triangleFaceIds: FaceId[];
}

export function triangulateFaces(
  mesh: HalfEdgeMesh,
  request: TriangulateFacesRequest,
  ctx: MeshOperationContext,
): TriangulateFacesResult {
  return runTransactionalMeshOp(mesh, () => {
  const faceIds = request.faceIds ?? [...mesh.faces.keys()];
  if (request.faceIds) {
    for (const faceId of request.faceIds) {
      if (!mesh.faces.has(faceId)) {
        throw new RangeError(`Face ${faceId} does not exist`);
      }
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const triangleFaceIds: FaceId[] = [];

  for (const faceId of faceIds) {
    const face = mesh.faces.get(faceId);
    if (!face) {
      continue;
    }
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      continue;
    }
    if (loop.length === 3) {
      triangleFaceIds.push(faceId);
      continue;
    }

    const corners = mesh.getFaceCorners(faceId);
    const uvs = corners.map((id) => mesh.corners.get(id)?.uv);
    const hasUv = uvs.every((uv) => uv !== undefined);
    const materialSlot = face.materialSlot;
    const isSmooth = face.isSmooth;
    const origin = loop[0]!;
    const created: FaceId[] = [faceId];

    deleteFace(mesh, faceId);
    const builder = MeshBuilder.fromMesh(mesh);
    for (let i = 1; i < loop.length - 1; i++) {
      const id = i === 1 ? faceId : ctx.idFactory.face();
      if (id !== faceId) {
        mapping.createFace(id, [faceId]);
        created.push(id);
      }
      const tri: VertexId[] = [origin, loop[i]!, loop[i + 1]!];
      builder.addFace(tri, {
        id,
        materialSlot,
        isSmooth,
        ...(hasUv
          ? {
              uvs: [uvs[0]!, uvs[i]!, uvs[i + 1]!],
            }
          : {}),
      });
      triangleFaceIds.push(id);
    }
    mapping.replaceFace(faceId, created);
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: triangleFaceIds },
    warnings: [],
    triangleFaceIds,
  };
  });
}
