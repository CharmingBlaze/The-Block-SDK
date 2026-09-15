import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { cloneMesh } from "../serialize";
import { triangulateFaces } from "./triangulate-faces";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export type FillBoundaryMethod = "ngon" | "fan" | "triangulate";

export interface FillBoundaryRequest {
  readonly boundaryEdgeIds: readonly EdgeId[];
  readonly method: FillBoundaryMethod;
}

export interface FillBoundaryResult extends MeshOperationResult {
  readonly newFaceIds: FaceId[];
}

export function fillBoundary(
  mesh: HalfEdgeMesh,
  request: FillBoundaryRequest,
  ctx: MeshOperationContext,
): FillBoundaryResult {
  return runTransactionalMeshOp(mesh, () => {
  if (request.boundaryEdgeIds.length < 3) {
    throw new RangeError("fillBoundary requires at least 3 boundary edges");
  }
  const loop = orderBoundaryLoop(mesh, request.boundaryEdgeIds);
  if (loop.length < 3) {
    throw new RangeError("fillBoundary could not form a closed boundary loop");
  }

  const mapping = new TopologyMappingBuilder(mesh);
  const start = cloneMesh(mesh);
  const builder = MeshBuilder.fromMesh(mesh);
  const newFaceIds: FaceId[] = [];

  if (request.method === "fan") {
    const hub = loop[0]!;
    for (let i = 1; i < loop.length - 1; i += 1) {
      const faceId = ctx.idFactory.face();
      builder.addFace([hub, loop[i]!, loop[i + 1]!], { id: faceId });
      mapping.createFace(faceId);
      newFaceIds.push(faceId);
    }
  } else {
    const faceId = ctx.idFactory.face();
    builder.addFace(loop, { id: faceId });
    mapping.createFace(faceId);
    newFaceIds.push(faceId);
    if (request.method === "triangulate" && loop.length > 3) {
      const tri = triangulateFaces(mesh, { faceIds: [faceId] }, ctx);
      newFaceIds.length = 0;
      newFaceIds.push(...tri.triangleFaceIds);
    }
  }

  mapping.snapshotNewElements(start, mesh);
  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: newFaceIds },
    warnings: [],
    newFaceIds,
  };
  });
}

function orderBoundaryLoop(mesh: HalfEdgeMesh, edgeIds: readonly EdgeId[]): VertexId[] {
  const unique = [...new Set(edgeIds)];
  const directed: Array<{ a: VertexId; b: VertexId; edgeId: EdgeId }> = [];
  for (const edgeId of unique) {
    if (!mesh.edges.has(edgeId)) {
      throw new RangeError(`Edge ${edgeId} does not exist`);
    }
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    const faceId = f1 ?? f2 ?? null;
    if ((f1 && f2) || !faceId) {
      throw new RangeError(`Edge ${edgeId} is not a boundary edge`);
    }
    const loop = mesh.getFaceVertices(faceId);
    const edges = mesh.getFaceEdges(faceId);
    const i = edges.indexOf(edgeId);
    if (i < 0) {
      throw new RangeError(`Edge ${edgeId} is missing from incident face ${faceId}`);
    }
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    directed.push({ a: b, b: a, edgeId });
  }

  const start = directed[0]!;
  const verts: VertexId[] = [start.a];
  const used = new Set<EdgeId>([start.edgeId]);
  let curr = start.b;
  let steps = 0;
  const limit = directed.length + 1;
  while (curr !== start.a) {
    steps += 1;
    if (steps > limit) {
      throw new RangeError("fillBoundary edges do not form a single closed loop");
    }
    const next = directed.find((d) => d.a === curr && !used.has(d.edgeId));
    if (!next) {
      throw new RangeError("fillBoundary edges do not form a single closed loop");
    }
    verts.push(curr);
    used.add(next.edgeId);
    curr = next.b;
  }
  if (used.size !== directed.length) {
    throw new RangeError("fillBoundary edges do not form a single closed loop");
  }
  return verts;
}
