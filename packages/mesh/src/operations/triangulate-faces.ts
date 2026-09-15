import type { FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { attributesToFaceOptions, cloneCornerAttributes } from "../internal/corner-attributes";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { triangulatePolygon } from "../polygon-triangulation";
import type { MeshOperationContext, MeshOperationResult, MeshOperationWarning } from "./contract";
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
  const warnings: MeshOperationWarning[] = [];

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
    const previousCorners = [...corners];
    const cornerAttrs = corners.map((id) => cloneCornerAttributes(mesh.corners.get(id)));
    const points = loop.map((id) => {
      const position = mesh.vertices.get(id)?.position;
      if (!position) {
        throw new RangeError(`Face ${faceId} references missing vertex ${id}`);
      }
      return position;
    });
    const triangulation = triangulatePolygon(points, {
      epsilon: ctx.tolerance.epsilon,
      rejectSelfIntersecting: ctx.validation === "strict",
    });
    if (triangulation.status === "self-intersecting") {
      throw new RangeError(`Face ${faceId} is self-intersecting and cannot be triangulated`);
    }
    if (triangulation.status !== "ok" || triangulation.triangles.length === 0) {
      throw new RangeError(`Face ${faceId} cannot be triangulated`);
    }
    if (triangulation.nonPlanar) {
      warnings.push({
        code: "non-planar-face",
        message: `Face ${faceId} is non-planar; triangulation used the dominant-plane projection`,
        elementIds: [faceId],
      });
    }

    const materialSlot = face.materialSlot;
    const materialSlotId = face.materialSlotId;
    const isSmooth = face.isSmooth;
    const created: FaceId[] = [faceId];

    deleteFace(mesh, faceId);
    const builder = MeshBuilder.fromMesh(mesh);
    triangulation.triangles.forEach((tri, index) => {
      const id = index === 0 ? faceId : ctx.idFactory.face();
      if (id !== faceId) {
        mapping.createFace(id, [faceId]);
        created.push(id);
      }
      const verts: VertexId[] = [loop[tri[0]]!, loop[tri[1]]!, loop[tri[2]]!];
      const attrs = [
        cornerAttrs[tri[0]]!,
        cornerAttrs[tri[1]]!,
        cornerAttrs[tri[2]]!,
      ];
      builder.addFace(verts, {
        id,
        materialSlot,
        materialSlotId,
        isSmooth,
        ...attributesToFaceOptions(attrs),
      });
      triangleFaceIds.push(id);
    });
    mapping.replaceFace(faceId, created);
    mapping.recordFaceRebuild(mesh, faceId, previousCorners);
    for (const createdId of created) {
      if (createdId !== faceId) {
        mapping.recordFaceRebuild(mesh, createdId, previousCorners);
      }
    }
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: triangleFaceIds },
    warnings,
    triangleFaceIds,
  };
  });
}
