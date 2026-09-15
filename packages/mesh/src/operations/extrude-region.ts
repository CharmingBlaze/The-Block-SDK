import type { FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { collectBoundaryEdges } from "../internal/boundary-cycles";
import { deleteFace, faceNormal } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface ExtrudeRegionRequest {
  readonly faceIds: readonly FaceId[];
  readonly distance: number;
}

export interface ExtrudeRegionResult extends MeshOperationResult {
  readonly capFaceIds: FaceId[];
  readonly sideFaceIds: FaceId[];
  readonly vertexMap: ReadonlyMap<VertexId, VertexId>;
}

export function extrudeRegion(
  mesh: HalfEdgeMesh,
  request: ExtrudeRegionRequest,
  ctx: MeshOperationContext,
): ExtrudeRegionResult {
  return runTransactionalMeshOp(mesh, () => {
  const selected = [...new Set(request.faceIds)];
  if (selected.length === 0) {
    throw new RangeError("extrudeRegion requires at least one face");
  }
  for (const faceId of selected) {
    if (!mesh.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
  }

  const mapping = new TopologyMappingBuilder(mesh);
  const selectedSet = new Set(selected);
  const regionNormal = averageRegionNormal(mesh, selected);
  const offset = regionNormal.scale(request.distance);

  const vertexMap = new Map<VertexId, VertexId>();
  let builder = MeshBuilder.fromMesh(mesh);
  for (const faceId of selected) {
    for (const vertexId of mesh.getFaceVertices(faceId)) {
      if (vertexMap.has(vertexId)) {
        continue;
      }
      const src = mesh.vertices.get(vertexId)!;
      const mapped = builder.addVertex(
        src.position[0] + offset.x,
        src.position[1] + offset.y,
        src.position[2] + offset.z,
        ctx.idFactory.vertex(),
      );
      vertexMap.set(vertexId, mapped);
      mapping.createVertex(mapped, [vertexId]);
    }
  }

  const boundary = collectBoundaryEdges(mesh, selectedSet);
  const facePlans = selected.map((faceId) => {
    const face = mesh.faces.get(faceId)!;
    return {
      faceId,
      loop: mesh.getFaceVertices(faceId).map((id) => vertexMap.get(id)!),
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
    };
  });

  for (const faceId of selected) {
    deleteFace(mesh, faceId);
  }

  builder = MeshBuilder.fromMesh(mesh);
  const capFaceIds: FaceId[] = [];
  for (const plan of facePlans) {
    const capId = builder.addFace(plan.loop, {
      id: plan.faceId,
      materialSlot: plan.materialSlot,
      isSmooth: plan.isSmooth,
    });
    capFaceIds.push(capId);
  }

  const sideFaceIds: FaceId[] = [];
  for (const edge of boundary) {
    const a = edge.a;
    const b = edge.b;
    const na = vertexMap.get(a)!;
    const nb = vertexMap.get(b)!;
    const sideId = builder.addFace([a, b, nb, na], { id: ctx.idFactory.face() });
    mapping.createFace(sideId);
    sideFaceIds.push(sideId);
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

function averageRegionNormal(mesh: HalfEdgeMesh, faceIds: readonly FaceId[]): Vector3 {
  let n = new Vector3(0, 0, 0);
  for (const faceId of faceIds) {
    n = n.add(faceNormal(mesh, faceId));
  }
  if (n.length() < 1e-8) {
    return new Vector3(0, 1, 0);
  }
  return n.normalize();
}

