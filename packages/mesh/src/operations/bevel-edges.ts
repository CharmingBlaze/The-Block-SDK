import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import {
  attributesToFaceOptions,
  cloneCornerAttributes,
  interpolateCornerAttributes,
  type CornerAttributes,
} from "../internal/corner-attributes";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { EdgeRecord } from "../types";
import type { MeshOperationContext, MeshOperationResult, MeshOperationWarning } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export type BevelWidthMode = "offset" | "percent";

export interface BevelEdgesRequest {
  readonly edgeIds: readonly EdgeId[];
  /** World-space distance when `widthMode` is `"offset"` (default). */
  readonly offset: number;
  readonly widthMode?: BevelWidthMode;
  /**
   * Polyline rounding between the two offset endpoints. This is not a
   * cylindrical Blender-style profile; it interpolates around the original vertex.
   */
  readonly segments?: number;
}

export interface BevelEdgesResult extends MeshOperationResult {
  readonly chamferFaceIds: FaceId[];
  readonly remainingFaceIds: FaceId[];
}

interface SelectedEdgePlan {
  readonly edgeId: EdgeId;
  readonly a: VertexId;
  readonly b: VertexId;
  readonly f1: FaceId;
  readonly f2: FaceId;
  readonly nA1: VertexId;
  readonly nB1: VertexId;
  readonly nA2: VertexId;
  readonly nB2: VertexId;
  readonly edgeRecord: EdgeRecord;
}

/**
 * Chamfers a connected edge network in one topology pass.
 * Offset is a geometric distance in model units unless `widthMode: "percent"`.
 */
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
  if (request.edgeIds.length === 0) {
    throw new RangeError("bevelEdges requires at least one edge");
  }
  if (!Number.isFinite(request.offset) || request.offset <= 0) {
    throw new RangeError("bevel offset must be a positive finite distance");
  }
  const widthMode: BevelWidthMode = request.widthMode ?? "offset";
  const segments = Math.max(1, Math.floor(request.segments ?? 1));
  const selected = new Set<EdgeId>();
  const plans: SelectedEdgePlan[] = [];
  const warnings: MeshOperationWarning[] = [];

  for (const edgeId of request.edgeIds) {
    if (selected.has(edgeId)) {
      continue;
    }
    if (!mesh.edges.has(edgeId)) {
      throw new RangeError(`Edge ${edgeId} does not exist`);
    }
    const ends = mesh.getEdgeVertices(edgeId);
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!ends || !f1 || !f2) {
      throw new RangeError(`Edge ${edgeId} is not a manifold interior edge`);
    }
    const [a, b] = ends;
    const loop1 = mesh.getFaceVertices(f1);
    const loop2 = mesh.getFaceVertices(f2);
    const edgeRecord = mesh.edges.get(edgeId)!;
    plans.push({
      edgeId,
      a,
      b,
      f1,
      f2,
      nA1: otherNeighbor(loop1, a, b),
      nB1: otherNeighbor(loop1, b, a),
      nA2: otherNeighbor(loop2, a, b),
      nB2: otherNeighbor(loop2, b, a),
      edgeRecord: { ...edgeRecord, seamChannels: edgeRecord.seamChannels ? [...edgeRecord.seamChannels] : undefined },
    });
    selected.add(edgeId);
  }

  const offsetCache = new Map<string, VertexId>();
  const tByKey = new Map<string, number>();
  const mapping = new TopologyMappingBuilder(mesh);
  let builder = MeshBuilder.fromMesh(mesh);
  const chamferFaceIds: FaceId[] = [];
  const remainingFaceIds: FaceId[] = [];

  const offsetToward = (from: VertexId, toward: VertexId): VertexId => {
    const key = `${from}::${toward}`;
    const existing = offsetCache.get(key);
    if (existing) {
      return existing;
    }
    const fromPos = mesh.vertices.get(from)!.position;
    const towardPos = mesh.vertices.get(toward)!.position;
    const dx = towardPos[0] - fromPos[0];
    const dy = towardPos[1] - fromPos[1];
    const dz = towardPos[2] - fromPos[2];
    const length = Math.hypot(dx, dy, dz);
    if (length <= ctx.tolerance.epsilon) {
      throw new RangeError(`Cannot bevel along a degenerate edge at vertex ${from}`);
    }
    let t: number;
    if (widthMode === "percent") {
      t = Math.min(0.45, request.offset);
      if (request.offset > 0.45) {
        warnings.push({
          code: "bevel-clamped",
          message: `Percent width ${request.offset} exceeded 0.45 and was clamped`,
        });
      }
    } else {
      const maxDistance = 0.45 * length;
      const distance = Math.min(request.offset, maxDistance);
      t = distance / length;
      if (request.offset > maxDistance + ctx.tolerance.epsilon) {
        warnings.push({
          code: "bevel-clamped",
          message: `Offset ${request.offset} exceeded ${maxDistance.toFixed(6)} on an adjacent edge and was clamped`,
          elementIds: [from, toward],
        });
      }
    }
    const id = ctx.idFactory.vertex();
    builder.addVertex(fromPos[0] + dx * t, fromPos[1] + dy * t, fromPos[2] + dz * t, id);
    mapping.createVertex(id, [from]);
    offsetCache.set(key, id);
    tByKey.set(key, t);
    return id;
  };

  for (const plan of plans) {
    offsetToward(plan.a, plan.nA1);
    offsetToward(plan.b, plan.nB1);
    offsetToward(plan.a, plan.nA2);
    offsetToward(plan.b, plan.nB2);
  }

  const arcCache = new Map<string, VertexId[]>();
  const profileArc = (center: VertexId, fromId: VertexId, toId: VertexId): VertexId[] => {
    const key = `${center}::${fromId}::${toId}::${segments}`;
    const existing = arcCache.get(key);
    if (existing) {
      return existing;
    }
    const reverseKey = `${center}::${toId}::${fromId}::${segments}`;
    const reverse = arcCache.get(reverseKey);
    if (reverse) {
      return [...reverse].reverse();
    }
    const ids: VertexId[] = [fromId];
    if (segments > 1) {
      const centerPos = vertexPos(mesh, center);
      const from = vertexPos(mesh, fromId);
      const to = vertexPos(mesh, toId);
      for (let k = 1; k < segments; k += 1) {
        const p = arcPoint(centerPos, from, to, k / segments);
        const id = ctx.idFactory.vertex();
        builder.addVertex(p[0], p[1], p[2], id);
        mapping.createVertex(id, [center]);
        ids.push(id);
      }
    }
    ids.push(toId);
    arcCache.set(key, ids);
    return ids;
  };

  const affected = new Set<FaceId>();
  for (const plan of plans) {
    affected.add(plan.f1);
    affected.add(plan.f2);
    for (const faceId of mesh.getVertexFaces(plan.a)) {
      affected.add(faceId);
    }
    for (const faceId of mesh.getVertexFaces(plan.b)) {
      affected.add(faceId);
    }
  }

  const miterCache = new Map<string, VertexId>();
  const miterAt = (vertex: VertexId, towardA: VertexId, towardB: VertexId): VertexId => {
    const key = `${vertex}::${towardA < towardB ? `${towardA}::${towardB}` : `${towardB}::${towardA}`}`;
    const existing = miterCache.get(key);
    if (existing) {
      return existing;
    }
    const origin = mesh.vertices.get(vertex)!.position;
    const pa = mesh.vertices.get(towardA)!.position;
    const pb = mesh.vertices.get(towardB)!.position;
    const da = [pa[0] - origin[0], pa[1] - origin[1], pa[2] - origin[2]] as const;
    const db = [pb[0] - origin[0], pb[1] - origin[1], pb[2] - origin[2]] as const;
    const la = Math.hypot(da[0], da[1], da[2]);
    const lb = Math.hypot(db[0], db[1], db[2]);
    if (la <= ctx.tolerance.epsilon || lb <= ctx.tolerance.epsilon) {
      throw new RangeError(`Cannot bevel a degenerate corner at vertex ${vertex}`);
    }
    const ta = tByKey.get(`${vertex}::${towardA}`) ?? Math.min(0.45, request.offset / la);
    const tb = tByKey.get(`${vertex}::${towardB}`) ?? Math.min(0.45, request.offset / lb);
    offsetToward(vertex, towardA);
    offsetToward(vertex, towardB);
    const tA = tByKey.get(`${vertex}::${towardA}`) ?? ta;
    const tB = tByKey.get(`${vertex}::${towardB}`) ?? tb;
    const id = ctx.idFactory.vertex();
    builder.addVertex(
      origin[0] + da[0] * tA + db[0] * tB,
      origin[1] + da[1] * tA + db[1] * tB,
      origin[2] + da[2] * tA + db[2] * tB,
      id,
    );
    mapping.createVertex(id, [vertex]);
    miterCache.set(key, id);
    return id;
  };

  const endpointOnFace = (loop: readonly VertexId[], vertex: VertexId, edgeA: VertexId, edgeB: VertexId): VertexId => {
    const i = loop.indexOf(vertex);
    if (i < 0) {
      throw new RangeError(`Vertex ${vertex} is not on the face loop`);
    }
    const prev = loop[(i - 1 + loop.length) % loop.length]!;
    const next = loop[(i + 1) % loop.length]!;
    const prevIsEdge = sameUndirected(prev, vertex, edgeA, edgeB);
    const nextIsEdge = sameUndirected(vertex, next, edgeA, edgeB);
    const selectedCount =
      (plans.some((plan) => sameUndirected(plan.a, plan.b, prev, vertex)) ? 1 : 0) +
      (plans.some((plan) => sameUndirected(plan.a, plan.b, vertex, next)) ? 1 : 0);
    if (selectedCount === 2) {
      return miterAt(vertex, prev, next);
    }
    if (prevIsEdge === nextIsEdge) {
      throw new RangeError(
        `Cannot bevel vertex ${vertex}: expected exactly one adjacent loop edge to match the selected edge`,
      );
    }
    const other = prevIsEdge ? next : prev;
    return offsetToward(vertex, other);
  };

  const selectedOnFace = (faceId: FaceId): SelectedEdgePlan[] =>
    plans.filter((plan) => {
      const loop = mesh.getFaceVertices(faceId);
      return edgeOnLoop(loop, plan.a, plan.b);
    });

  const faceSnapshots = [...affected].flatMap((faceId) => {
    const face = mesh.faces.get(faceId);
    if (!face) {
      return [];
    }
    const loop = mesh.getFaceVertices(faceId);
    const corners = mesh.getFaceCorners(faceId);
    return [
      {
        sourceFaceId: faceId,
        loop,
        corners: corners.map((id) => cloneCornerAttributes(mesh.corners.get(id))),
        materialSlot: face.materialSlot,
        materialSlotId: face.materialSlotId,
        isSmooth: face.isSmooth,
      },
    ];
  });

  const rebuiltLoops: Array<{
    sourceFaceId: FaceId;
    loop: VertexId[];
    attrs: CornerAttributes[];
    materialSlot: number;
    materialSlotId: typeof faceSnapshots[number]["materialSlotId"];
    isSmooth: boolean;
  }> = [];

  for (const snap of faceSnapshots) {
    const { loop, sourceFaceId } = snap;
    const n = loop.length;
    const nextLoop: VertexId[] = [];
    const nextAttrs: CornerAttributes[] = [];
    const onFace = selectedOnFace(sourceFaceId);
    for (let i = 0; i < n; i++) {
      const v = loop[i]!;
      const prev = loop[(i - 1 + n) % n]!;
      const next = loop[(i + 1) % n]!;
      const prevSelected = onFace.some((plan) => sameUndirected(plan.a, plan.b, prev, v));
      const nextSelected = onFace.some((plan) => sameUndirected(plan.a, plan.b, v, next));
      if (prevSelected && nextSelected) {
        const id = miterAt(v, prev, next);
        nextLoop.push(id);
        nextAttrs.push(interpolateAt(snap, v, next, tByKey.get(`${v}::${next}`) ?? 0, ctx));
      } else if (nextSelected) {
        const id = offsetToward(v, prev);
        nextLoop.push(id);
        nextAttrs.push(interpolateAt(snap, v, prev, tByKey.get(`${v}::${prev}`) ?? 0, ctx));
      } else if (prevSelected) {
        const id = offsetToward(v, next);
        nextLoop.push(id);
        nextAttrs.push(interpolateAt(snap, v, next, tByKey.get(`${v}::${next}`) ?? 0, ctx));
      } else if (isBeveledVertex(v, plans)) {
        const from = offsetToward(v, prev);
        const to = offsetToward(v, next);
        const arc = profileArc(v, from, to);
        for (let k = 0; k < arc.length; k++) {
          const t = arc.length === 1 ? 0 : k / (arc.length - 1);
          nextLoop.push(arc[k]!);
          nextAttrs.push(interpolateAt(snap, prev, next, t, ctx));
        }
      } else {
        nextLoop.push(v);
        nextAttrs.push(cloneCornerAttributes(snap.corners[i]));
      }
    }
    rebuiltLoops.push({
      sourceFaceId,
      loop: dedupeConsecutive(nextLoop, nextAttrs).loop,
      attrs: dedupeConsecutive(nextLoop, nextAttrs).attrs,
      materialSlot: snap.materialSlot,
      materialSlotId: snap.materialSlotId,
      isSmooth: snap.isSmooth,
    });
  }

  for (const faceId of affected) {
    deleteFace(mesh, faceId);
    mapping.deleteFace(faceId);
  }
  builder = MeshBuilder.fromMesh(mesh);

  for (const plan of rebuiltLoops) {
    const id = builder.addFace(plan.loop, {
      id: ctx.idFactory.face(),
      materialSlot: plan.materialSlot,
      materialSlotId: plan.materialSlotId,
      isSmooth: plan.isSmooth,
      ...attributesToFaceOptions(plan.attrs),
    });
    mapping.createFace(id, [plan.sourceFaceId]);
    mapping.replaceFace(plan.sourceFaceId, [id]);
    if (plans.some((item) => item.f1 === plan.sourceFaceId || item.f2 === plan.sourceFaceId)) {
      remainingFaceIds.push(id);
    }
  }

  for (const plan of plans) {
    const loop1 = faceSnapshots.find((item) => item.sourceFaceId === plan.f1)?.loop;
    const loop2 = faceSnapshots.find((item) => item.sourceFaceId === plan.f2)?.loop;
    if (!loop1 || !loop2) {
      throw new RangeError(`Bevel lost face ${plan.f1} while planning edge ${plan.edgeId}`);
    }
    const vA1 = endpointOnFace(loop1, plan.a, plan.a, plan.b);
    const vB1 = endpointOnFace(loop1, plan.b, plan.a, plan.b);
    const vA2 = endpointOnFace(loop2, plan.a, plan.a, plan.b);
    const vB2 = endpointOnFace(loop2, plan.b, plan.a, plan.b);
    const arcA = profileArc(plan.a, vA1, vA2);
    const arcB = profileArc(plan.b, vB1, vB2);
    const along1 = alongChamfer(loop1, plan.a, plan.b, vA1, vB1);
    const start1 = along1[0]!;
    const end1 = along1[1]!;
    const ringStart = start1 === vA1 ? arcA : arcB;
    const ringEnd = end1 === vA1 ? arcA : arcB;
    const sourceFace = faceSnapshots.find((item) => item.sourceFaceId === plan.f1);
    for (let k = 0; k < segments; k += 1) {
      const quad = [ringEnd[k]!, ringStart[k]!, ringStart[k + 1]!, ringEnd[k + 1]!];
      const chamferId = builder.addFace(quad, {
        id: ctx.idFactory.face(),
        materialSlot: sourceFace?.materialSlot ?? 0,
        materialSlotId: sourceFace?.materialSlotId,
        isSmooth: segments > 1,
      });
      mapping.createFace(chamferId, [plan.f1, plan.f2]);
      chamferFaceIds.push(chamferId);
    }
    mapping.deleteEdge(plan.edgeId);
    if (ctx.attributes.preserveSeams || ctx.attributes.preserveSharps) {
      transferEdgeAttributes(mesh, plan, vA1, vB1, vA2, vB2, ctx);
    }
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: chamferFaceIds },
    warnings,
    chamferFaceIds,
    remainingFaceIds,
  };
}

function interpolateAt(
  snap: { loop: readonly VertexId[]; corners: readonly CornerAttributes[] },
  from: VertexId,
  toward: VertexId,
  t: number,
  ctx: MeshOperationContext,
): CornerAttributes {
  const iFrom = snap.loop.indexOf(from);
  const iToward = snap.loop.indexOf(toward);
  const a = iFrom >= 0 ? snap.corners[iFrom] : undefined;
  const b = iToward >= 0 ? snap.corners[iToward] : undefined;
  return interpolateCornerAttributes(a, b, t, ctx.attributes);
}

function isBeveledVertex(vertex: VertexId, plans: readonly SelectedEdgePlan[]): boolean {
  return plans.some((plan) => plan.a === vertex || plan.b === vertex);
}

function edgeOnLoop(loop: readonly VertexId[], a: VertexId, b: VertexId): boolean {
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const x = loop[i]!;
    const y = loop[(i + 1) % n]!;
    if (sameUndirected(a, b, x, y)) {
      return true;
    }
  }
  return false;
}

function sameUndirected(a: VertexId, b: VertexId, c: VertexId, d: VertexId): boolean {
  return (a === c && b === d) || (a === d && b === c);
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

function dedupeConsecutive(
  loop: readonly VertexId[],
  attrs: readonly CornerAttributes[],
): { loop: VertexId[]; attrs: CornerAttributes[] } {
  const nextLoop: VertexId[] = [];
  const nextAttrs: CornerAttributes[] = [];
  for (let i = 0; i < loop.length; i++) {
    const id = loop[i]!;
    if (nextLoop[nextLoop.length - 1] === id) {
      continue;
    }
    nextLoop.push(id);
    nextAttrs.push(attrs[i]!);
  }
  if (nextLoop.length > 1 && nextLoop[0] === nextLoop[nextLoop.length - 1]) {
    nextLoop.pop();
    nextAttrs.pop();
  }
  return { loop: nextLoop, attrs: nextAttrs };
}

function transferEdgeAttributes(
  mesh: HalfEdgeMesh,
  plan: SelectedEdgePlan,
  vA1: VertexId,
  vB1: VertexId,
  vA2: VertexId,
  vB2: VertexId,
  ctx: MeshOperationContext,
): void {
  const pairs: Array<[VertexId, VertexId]> = [
    [vA1, vB1],
    [vA2, vB2],
  ];
  for (const [x, y] of pairs) {
    for (const [edgeId] of mesh.edges) {
      const ends = mesh.getEdgeVertices(edgeId);
      if (!ends) {
        continue;
      }
      if (!sameUndirected(ends[0], ends[1], x, y)) {
        continue;
      }
      const edge = mesh.edges.get(edgeId);
      if (!edge) {
        continue;
      }
      if (ctx.attributes.preserveSeams) {
        edge.isSeam = plan.edgeRecord.isSeam;
        if (plan.edgeRecord.seamChannels) {
          edge.seamChannels = [...plan.edgeRecord.seamChannels];
        }
      }
      if (ctx.attributes.preserveSharps) {
        edge.creaseAngle = plan.edgeRecord.creaseAngle;
      }
    }
  }
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
