import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface BevelEdgesRequest {
  readonly edgeIds: readonly EdgeId[];
  readonly offset: number;
  readonly segments?: number;
}

export interface BevelEdgesResult extends MeshOperationResult {
  readonly chamferFaceIds: FaceId[];
  readonly remainingFaceIds: FaceId[];
}

export function bevelEdges(
  mesh: HalfEdgeMesh,
  request: BevelEdgesRequest,
  ctx: MeshOperationContext,
): BevelEdgesResult {
  return runTransactionalMeshOp(mesh, () => bevelEdgesUnlocked(mesh, request, ctx));
}

function bevelEdgesUnlocked(
  mesh: HalfEdgeMesh,
  request: BevelEdgesRequest,
  ctx: MeshOperationContext,
): BevelEdgesResult {
  const t = Math.min(0.45, Math.max(0.05, request.offset));
  const segments = Math.max(1, Math.floor(request.segments ?? 1));
  if (request.edgeIds.length === 0) {
    throw new RangeError("bevelEdges requires at least one edge");
  }
  for (const edgeId of request.edgeIds) {
    if (!mesh.edges.has(edgeId)) {
      throw new RangeError(`Edge ${edgeId} does not exist`);
    }
    const ends = mesh.getEdgeVertices(edgeId);
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!ends || !f1 || !f2) {
      throw new RangeError(`Edge ${edgeId} is not a manifold interior edge`);
    }
  }
  const mapping = new TopologyMappingBuilder(mesh);
  const chamferFaceIds: FaceId[] = [];
  const remainingFaceIds: FaceId[] = [];

  for (const edgeId of request.edgeIds) {
    if (!mesh.edges.has(edgeId)) {
      continue;
    }
    const ends = mesh.getEdgeVertices(edgeId);
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!ends || !f1 || !f2) {
      throw new RangeError(`Edge ${edgeId} is not a manifold interior edge`);
    }
    const [a, b] = ends;
    const loop1 = mesh.getFaceVertices(f1);
    const loop2 = mesh.getFaceVertices(f2);
    const nA1 = otherNeighbor(loop1, a, b);
    const nB1 = otherNeighbor(loop1, b, a);
    const nA2 = otherNeighbor(loop2, a, b);
    const nB2 = otherNeighbor(loop2, b, a);

    let builder = MeshBuilder.fromMesh(mesh);
    const vA1 = lerpVertex(mesh, a, nA1, t, ctx, builder, mapping);
    const vB1 = lerpVertex(mesh, b, nB1, t, ctx, builder, mapping);
    const vA2 = lerpVertex(mesh, a, nA2, t, ctx, builder, mapping);
    const vB2 = lerpVertex(mesh, b, nB2, t, ctx, builder, mapping);
    const arcA = buildProfileArc(mesh, a, vA1, vA2, segments, ctx, builder, mapping);
    const arcB = buildProfileArc(mesh, b, vB1, vB2, segments, ctx, builder, mapping);

    const offsetFromA = new Map<VertexId, VertexId>([
      [nA1, vA1],
      [nA2, vA2],
    ]);
    const offsetFromB = new Map<VertexId, VertexId>([
      [nB1, vB1],
      [nB2, vB2],
    ]);

    const affected = new Set<FaceId>([f1, f2, ...mesh.getVertexFaces(a), ...mesh.getVertexFaces(b)]);
    const plans: Array<{
      sourceFaceId: FaceId;
      loop: VertexId[];
      materialSlot: number;
      isSmooth: boolean;
    }> = [];
    for (const faceId of affected) {
      const face = mesh.faces.get(faceId);
      if (!face) {
        continue;
      }
      const loop = mesh.getFaceVertices(faceId);
      const n = loop.length;
      const iA = loop.indexOf(a);
      const iB = loop.indexOf(b);
      let nextLoop = [...loop];
      if (faceId === f1) {
        nextLoop = loop.map((id) => (id === a ? vA1 : id === b ? vB1 : id));
      } else if (faceId === f2) {
        nextLoop = loop.map((id) => (id === a ? vA2 : id === b ? vB2 : id));
      } else if (iA >= 0 && iB < 0) {
        const prev = loop[(iA - 1 + n) % n]!;
        const next = loop[(iA + 1) % n]!;
        nextLoop = replaceEndpoint(loop, a, offsetFromA.get(prev), offsetFromA.get(next), arcA);
      } else if (iB >= 0 && iA < 0) {
        const prev = loop[(iB - 1 + n) % n]!;
        const next = loop[(iB + 1) % n]!;
        nextLoop = replaceEndpoint(loop, b, offsetFromB.get(prev), offsetFromB.get(next), arcB);
      }
      plans.push({
        sourceFaceId: faceId,
        loop: nextLoop,
        materialSlot: face.materialSlot,
        isSmooth: face.isSmooth,
      });
    }

    const slot1 = mesh.faces.get(f1)?.materialSlot ?? 0;
    const along1 = alongChamfer(loop1, a, b, vA1, vB1);

    for (const faceId of affected) {
      deleteFace(mesh, faceId);
      mapping.deleteFace(faceId);
    }
    builder = MeshBuilder.fromMesh(mesh);
    for (const plan of plans) {
      const id = builder.addFace(plan.loop, {
        id: ctx.idFactory.face(),
        materialSlot: plan.materialSlot,
        isSmooth: plan.isSmooth,
      });
      mapping.createFace(id, [plan.sourceFaceId]);
      mapping.replaceFace(plan.sourceFaceId, [id]);
      if (plan.sourceFaceId === f1 || plan.sourceFaceId === f2) {
        remainingFaceIds.push(id);
      }
    }

    const start1 = along1[0]!;
    const end1 = along1[1]!;
    const ringStart = start1 === vA1 ? arcA : arcB;
    const ringEnd = end1 === vA1 ? arcA : arcB;
    for (let k = 0; k < segments; k += 1) {
      const chamferId = builder.addFace(
        [ringEnd[k]!, ringStart[k]!, ringStart[k + 1]!, ringEnd[k + 1]!],
        {
          id: ctx.idFactory.face(),
          materialSlot: slot1,
          isSmooth: segments > 1,
        },
      );
      mapping.createFace(chamferId);
      chamferFaceIds.push(chamferId);
    }
    mapping.deleteEdge(edgeId);
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: chamferFaceIds },
    warnings: [],
    chamferFaceIds,
    remainingFaceIds,
  };
}

function lerpVertex(
  mesh: HalfEdgeMesh,
  from: VertexId,
  toward: VertexId,
  t: number,
  ctx: MeshOperationContext,
  builder: MeshBuilder,
  mapping: TopologyMappingBuilder,
): VertexId {
  const a = mesh.vertices.get(from)!;
  const b = mesh.vertices.get(toward)!;
  const id = ctx.idFactory.vertex();
  builder.addVertex(
    a.position[0] + (b.position[0] - a.position[0]) * t,
    a.position[1] + (b.position[1] - a.position[1]) * t,
    a.position[2] + (b.position[2] - a.position[2]) * t,
    id,
  );
  mapping.createVertex(id, [from]);
  return id;
}

function otherNeighbor(loop: readonly VertexId[], vertex: VertexId, not: VertexId): VertexId {
  const i = loop.indexOf(vertex);
  if (i < 0) {
    throw new RangeError("Vertex is not on the face loop");
  }
  const n = loop.length;
  const prev = loop[(i - 1 + n) % n]!;
  const next = loop[(i + 1) % n]!;
  return next === not ? prev : next;
}

function alongChamfer(
  loop: readonly VertexId[],
  a: VertexId,
  b: VertexId,
  vA: VertexId,
  vB: VertexId,
): [VertexId, VertexId] {
  const iA = loop.indexOf(a);
  const next = loop[(iA + 1) % loop.length];
  return next === b ? [vA, vB] : [vB, vA];
}

function replaceEndpoint(
  loop: readonly VertexId[],
  vertex: VertexId,
  towardPrev: VertexId | undefined,
  towardNext: VertexId | undefined,
  arc: readonly VertexId[],
): VertexId[] {
  const i = loop.indexOf(vertex);
  if (i < 0) {
    return [...loop];
  }
  const start = arc[0]!;
  const end = arc[arc.length - 1]!;
  let insert: VertexId[] = [];
  if (towardPrev === start && towardNext === end) {
    insert = [...arc];
  } else if (towardPrev === end && towardNext === start) {
    insert = [...arc].reverse();
  } else {
    if (towardPrev) {
      insert.push(towardPrev);
    }
    if (towardNext) {
      insert.push(towardNext);
    }
  }
  return [...loop.slice(0, i), ...insert, ...loop.slice(i + 1)];
}

function buildProfileArc(
  mesh: HalfEdgeMesh,
  centerId: VertexId,
  fromId: VertexId,
  toId: VertexId,
  segments: number,
  ctx: MeshOperationContext,
  builder: MeshBuilder,
  mapping: TopologyMappingBuilder,
): VertexId[] {
  const ids: VertexId[] = [fromId];
  const center = vertexPos(mesh, centerId);
  const from = vertexPos(mesh, fromId);
  const to = vertexPos(mesh, toId);
  for (let k = 1; k < segments; k += 1) {
    const p = arcPoint(center, from, to, k / segments);
    const id = ctx.idFactory.vertex();
    builder.addVertex(p[0], p[1], p[2], id);
    mapping.createVertex(id, [centerId]);
    ids.push(id);
  }
  ids.push(toId);
  return ids;
}

function vertexPos(mesh: HalfEdgeMesh, id: VertexId): Vector3 {
  const p = mesh.vertices.get(id)!.position;
  return new Vector3(p[0], p[1], p[2]);
}

function arcPoint(center: Vector3, from: Vector3, to: Vector3, t: number): [number, number, number] {
  const v0 = from.sub(center);
  const v1 = to.sub(center);
  const r0 = v0.length();
  const r1 = v1.length();
  if (r0 < 1e-12 || r1 < 1e-12) {
    const p = from.lerp(to, t);
    return [p.x, p.y, p.z];
  }
  const n0 = v0.normalize();
  const n1 = v1.normalize();
  const cross = n0.cross(n1);
  const sin = cross.length();
  if (sin < 1e-8) {
    const p = from.lerp(to, t);
    return [p.x, p.y, p.z];
  }
  const axis = cross.scale(1 / sin);
  const angle = Math.atan2(sin, n0.dot(n1)) * t;
  const cos = Math.cos(angle);
  const s = Math.sin(angle);
  const rotated = n0
    .scale(cos)
    .add(axis.cross(n0).scale(s))
    .add(axis.scale(axis.dot(n0) * (1 - cos)));
  const r = r0 + (r1 - r0) * t;
  const p = center.add(rotated.scale(r));
  return [p.x, p.y, p.z];
}
