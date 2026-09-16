import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../../builder";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import {
  attributesToFaceOptions,
  averageCornerAttributes,
  cloneCornerAttributes,
  interpolateCornerAttributes,
  type CornerAttributes,
} from "../../internal/corner-attributes";
import { deleteFace } from "../../internal/delete-face";
import { TopologyMappingBuilder } from "../../internal/topology-mapping-builder";
import type { FaceRecord } from "../../types";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";
import { effectiveCreaseWeight, weightedEdgePoint } from "./edge-points";
import { propagateParentEdgeAttributes, snapshotParentEdges } from "./propagate";
import type { Vec3 } from "./types";
import { averageVec } from "./vec";
import { computeVertexPoint } from "./vertex-points";

interface FaceSnap {
  readonly id: FaceId;
  readonly loop: readonly VertexId[];
  readonly edges: readonly EdgeId[];
  readonly materialSlot: number;
  readonly materialSlotId: FaceRecord["materialSlotId"];
  readonly isSmooth: boolean;
  readonly corners: readonly CornerAttributes[];
}

export interface CatmullClarkOnceResult {
  readonly newFaceIds: FaceId[];
  readonly facePointId: ReadonlyMap<FaceId, VertexId>;
  readonly edgePointId: ReadonlyMap<EdgeId, VertexId>;
  readonly edgeEnds: ReadonlyMap<EdgeId, readonly [VertexId, VertexId]>;
  readonly faceLoops: ReadonlyMap<FaceId, readonly VertexId[]>;
}

export function catmullClarkOnce(
  mesh: HalfEdgeMesh,
  ctx: MeshOperationContext,
  mapping: TopologyMappingBuilder,
  warnings: MeshOperationWarning[],
): CatmullClarkOnceResult {
  const snaps: FaceSnap[] = [];
  for (const [faceId, face] of mesh.faces) {
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      warnings.push({
        code: "degenerate-face",
        message: `Face ${faceId} skipped because it has fewer than 3 vertices`,
        elementIds: [faceId],
      });
      continue;
    }
    snaps.push({
      id: faceId,
      loop,
      edges: mesh.getFaceEdges(faceId),
      materialSlot: face.materialSlot,
      materialSlotId: face.materialSlotId,
      isSmooth: face.isSmooth,
      corners: mesh.getFaceCorners(faceId).map((id) => cloneCornerAttributes(mesh.corners.get(id))),
    });
  }
  if (snaps.length === 0) {
    throw new RangeError("catmullClarkSubdivide requires at least one non-degenerate face");
  }

  const facesByVertex = new Map<VertexId, FaceId[]>();
  const edgesByVertex = new Map<VertexId, EdgeId[]>();
  const facesByEdge = new Map<EdgeId, FaceId[]>();
  const edgeEnds = new Map<EdgeId, readonly [VertexId, VertexId]>();

  for (const snap of snaps) {
    const n = snap.loop.length;
    for (let i = 0; i < n; i += 1) {
      const v = snap.loop[i]!;
      const e = snap.edges[i]!;
      const next = snap.loop[(i + 1) % n]!;
      pushUnique(facesByVertex, v, snap.id);
      pushUnique(edgesByVertex, v, e);
      pushUnique(edgesByVertex, next, e);
      pushUnique(facesByEdge, e, snap.id);
      if (!edgeEnds.has(e)) {
        edgeEnds.set(e, [v, next]);
      }
    }
  }

  const parentEdges = snapshotParentEdges(mesh, edgeEnds);
  const creaseWeightOf = (edgeId: EdgeId): number =>
    effectiveCreaseWeight(mesh, edgeId, (facesByEdge.get(edgeId) ?? []).length, ctx.validation);

  const facePointPos = new Map<FaceId, Vec3>();
  const facePointId = new Map<FaceId, VertexId>();
  for (const snap of snaps) {
    facePointPos.set(snap.id, averageVec(snap.loop.map((id) => mesh.vertices.get(id)!.position)));
    const id = ctx.idFactory.vertex();
    facePointId.set(snap.id, id);
    mapping.createVertex(id, [...snap.loop]);
  }

  const edgePointPos = new Map<EdgeId, Vec3>();
  const edgePointId = new Map<EdgeId, VertexId>();
  for (const [edgeId, ends] of edgeEnds) {
    const pos = weightedEdgePoint(
      mesh,
      ends,
      facesByEdge.get(edgeId) ?? [],
      facePointPos,
      creaseWeightOf(edgeId),
    );
    edgePointPos.set(edgeId, pos);
    const id = ctx.idFactory.vertex();
    edgePointId.set(edgeId, id);
    mapping.createVertex(id, [ends[0], ends[1]]);
  }

  const vertexPointPos = new Map<VertexId, Vec3>();
  for (const [vertexId] of mesh.vertices) {
    vertexPointPos.set(
      vertexId,
      computeVertexPoint({
        mesh,
        vertexId,
        incidentEdges: edgesByVertex.get(vertexId) ?? [],
        incidentFaces: facesByVertex.get(vertexId) ?? [],
        edgeEnds,
        facesByEdge,
        facePointPos,
        creaseWeightOf,
      }),
    );
  }

  for (const snap of snaps) {
    deleteFace(mesh, snap.id);
  }

  for (const [vertexId, pos] of vertexPointPos) {
    const vertex = mesh.vertices.get(vertexId);
    if (vertex) {
      vertex.position[0] = pos[0];
      vertex.position[1] = pos[1];
      vertex.position[2] = pos[2];
    }
  }

  const builder = MeshBuilder.fromMesh(mesh);
  for (const [faceId, pos] of facePointPos) {
    builder.addVertex(pos[0], pos[1], pos[2], facePointId.get(faceId)!);
  }
  for (const [edgeId, pos] of edgePointPos) {
    builder.addVertex(pos[0], pos[1], pos[2], edgePointId.get(edgeId)!);
  }

  const newFaceIds: FaceId[] = [];
  for (const snap of snaps) {
    const facePt = facePointId.get(snap.id)!;
    const n = snap.loop.length;
    const created: FaceId[] = [];
    const center = averageCornerAttributes(snap.corners, ctx.attributes);
    for (let i = 0; i < n; i += 1) {
      const childId = i === 0 ? snap.id : ctx.idFactory.face();
      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;
      const corners: CornerAttributes[] = [
        cloneCornerAttributes(snap.corners[i]),
        interpolateCornerAttributes(snap.corners[i], snap.corners[next], 0.5, ctx.attributes),
        cloneCornerAttributes(center),
        interpolateCornerAttributes(snap.corners[prev], snap.corners[i], 0.5, ctx.attributes),
      ];
      builder.addFace(
        [snap.loop[i]!, edgePointId.get(snap.edges[i]!)!, facePt, edgePointId.get(snap.edges[prev]!)!],
        {
          id: childId,
          materialSlot: snap.materialSlot,
          materialSlotId: snap.materialSlotId,
          isSmooth: snap.isSmooth,
          ...attributesToFaceOptions(corners),
        },
      );
      if (childId !== snap.id) {
        mapping.createFace(childId, [snap.id]);
      }
      created.push(childId);
      newFaceIds.push(childId);
    }
    mapping.replaceFace(snap.id, created);
  }

  for (const parent of parentEdges) {
    const mid = edgePointId.get(parent.edgeId);
    if (!mid) {
      continue;
    }
    const children: EdgeId[] = [];
    for (const end of parent.ends) {
      for (const [edgeId] of mesh.edges) {
        const ends = mesh.getEdgeVertices(edgeId);
        if (!ends) {
          continue;
        }
        if ((ends[0] === end && ends[1] === mid) || (ends[0] === mid && ends[1] === end)) {
          if (!children.includes(edgeId)) {
            children.push(edgeId);
            mapping.createEdge(edgeId, [parent.edgeId]);
          }
        }
      }
    }
    if (children.length > 0) {
      mapping.replaceEdge(parent.edgeId, children);
    } else {
      mapping.deleteEdge(parent.edgeId);
    }
  }

  propagateParentEdgeAttributes(mesh, parentEdges, edgePointId, ctx);
  return {
    newFaceIds,
    facePointId,
    edgePointId,
    edgeEnds,
    faceLoops: new Map(snaps.map((snap) => [snap.id, snap.loop])),
  };
}

function pushUnique<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) {
    list.push(value);
  }
}
