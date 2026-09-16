import type { FaceId, VertexId } from "@modeling-kit/core";
import { assertStrictMesh } from "../../internal/assert-mesh";
import type { SkinInfluence } from "../../internal/attribute-interpolation";
import { TopologyMappingBuilder } from "../../internal/topology-mapping-builder";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { cloneMesh } from "../../serialize";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";
import { runTransactionalMeshOp } from "../contract";
import { repairEdgeCreaseWeights } from "../creases/set";
import { subdivideSkinWeights } from "./skin";
import { catmullClarkOnce } from "./subdivide-once";
import type { CatmullClarkRequest, CatmullClarkResult } from "./types";

export type {
  CatmullClarkRequest,
  CatmullClarkResult,
} from "./types";

export function catmullClarkSubdivide(
  mesh: HalfEdgeMesh,
  request: CatmullClarkRequest,
  ctx: MeshOperationContext,
): CatmullClarkResult {
  return runTransactionalMeshOp(mesh, () => {
    if (mesh.faces.size === 0) {
      throw new RangeError("catmullClarkSubdivide requires at least one face");
    }
    if (ctx.validation === "repair") {
      repairEdgeCreaseWeights(mesh);
    }
    const iterations = Math.max(1, Math.floor(request.iterations ?? 1));
    const start = cloneMesh(mesh);
    const mapping = new TopologyMappingBuilder(mesh);
    const warnings: MeshOperationWarning[] = [];
    let newFaceIds: FaceId[] = [];
    let skinWeights: Map<VertexId, readonly SkinInfluence[]> | undefined = request.skinWeights
      ? new Map(request.skinWeights)
      : undefined;
    for (let i = 0; i < iterations; i += 1) {
      const once = catmullClarkOnce(mesh, ctx, mapping, warnings);
      newFaceIds = once.newFaceIds;
      skinWeights = subdivideSkinWeights({
        original: skinWeights,
        faceLoops: once.faceLoops,
        facePointId: once.facePointId,
        edgeEnds: once.edgeEnds,
        edgePointId: once.edgePointId,
        ctx,
        warnings,
      });
    }
    mapping.snapshotNewElements(start, mesh);
    assertStrictMesh(mesh, "catmullClarkSubdivide");
    const { mapping: topology, changes } = mapping.build(mesh);
    return {
      mesh,
      changes,
      mapping: topology,
      selection: { domain: "face", elementIds: newFaceIds },
      warnings,
      newFaceIds,
      iterations,
      ...(skinWeights ? { skinWeights } : {}),
    };
  });
}
