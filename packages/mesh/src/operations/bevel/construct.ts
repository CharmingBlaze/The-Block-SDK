import type { FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "../../builder";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import {
  attributesToFaceOptions,
  cloneCornerAttributes,
  interpolateCornerAttributes,
  type CornerAttributes,
} from "../../internal/corner-attributes";
import { deleteFace } from "../../internal/delete-face";
import { TopologyMappingBuilder } from "../../internal/topology-mapping-builder";
import type { MeshOperationContext } from "../contract";
import { hasAnyUv, transferEdgeAttributes } from "./attributes";
import {
  alongChamfer,
  dedupeConsecutive,
  edgeOnLoop,
  isBeveledVertex,
  sameUndirected,
  vertexPos,
} from "./geometry";
import type { CornerDecision } from "./miter";
import type { SelectedEdgePlan } from "./types";
import { offsetKey } from "./width";

export function constructBevel(input: {
  mesh: HalfEdgeMesh;
  ctx: MeshOperationContext;
  plans: readonly SelectedEdgePlan[];
  tByPair: ReadonlyMap<string, number>;
  cornerDecisions: ReadonlyMap<VertexId, CornerDecision>;
  segments: number;
}): {
  chamferFaceIds: FaceId[];
  remainingFaceIds: FaceId[];
  clipFaceIds: FaceId[];
  mapping: TopologyMappingBuilder;
} {
  const { mesh, ctx, plans, segments } = input;
  const tByKey = new Map(input.tByPair);
  const offsetCache = new Map<string, VertexId>();
  const miterCache = new Map<string, VertexId>();
  const mapping = new TopologyMappingBuilder(mesh);
  let builder = MeshBuilder.fromMesh(mesh);
  const chamferFaceIds: FaceId[] = [];
  const remainingFaceIds: FaceId[] = [];
  const clipFaceIds: FaceId[] = [];

  const offsetToward = (from: VertexId, toward: VertexId): VertexId => {
    const key = offsetKey(from, toward);
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
    const t = tByKey.get(key) ?? 0.45;
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

  const miterAt = (vertex: VertexId, towardA: VertexId, towardB: VertexId): VertexId => {
    const key = `${vertex}::${towardA < towardB ? `${towardA}::${towardB}` : `${towardB}::${towardA}`}`;
    const existing = miterCache.get(key);
    if (existing) {
      return existing;
    }
    const decision = input.cornerDecisions.get(vertex);
    offsetToward(vertex, towardA);
    offsetToward(vertex, towardB);
    const origin = mesh.vertices.get(vertex)!.position;
    const pa = mesh.vertices.get(towardA)!.position;
    const pb = mesh.vertices.get(towardB)!.position;
    const da = [pa[0] - origin[0], pa[1] - origin[1], pa[2] - origin[2]] as const;
    const db = [pb[0] - origin[0], pb[1] - origin[1], pb[2] - origin[2]] as const;
    const tA = tByKey.get(offsetKey(vertex, towardA)) ?? 0.45;
    const tB = tByKey.get(offsetKey(vertex, towardB)) ?? 0.45;
    const position = decision?.position ?? [
      origin[0] + da[0] * tA + db[0] * tB,
      origin[1] + da[1] * tA + db[1] * tB,
      origin[2] + da[2] * tA + db[2] * tB,
    ];
    const id = ctx.idFactory.vertex();
    builder.addVertex(position[0], position[1], position[2], id);
    mapping.createVertex(id, [vertex]);
    miterCache.set(key, id);
    return id;
  };

  const endpointOnFace = (
    loop: readonly VertexId[],
    vertex: VertexId,
    edgeA: VertexId,
    edgeB: VertexId,
  ): VertexId => {
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
      if (input.cornerDecisions.get(vertex)?.kind === "clip") {
        if (prevIsEdge === nextIsEdge) {
          throw new RangeError(`Cannot clip-bevel vertex ${vertex}`);
        }
        return offsetToward(vertex, prevIsEdge ? prev : next);
      }
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
    materialSlotId: (typeof faceSnapshots)[number]["materialSlotId"];
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
        if (input.cornerDecisions.get(v)?.kind === "clip") {
          const from = offsetToward(v, prev);
          const to = offsetToward(v, next);
          nextLoop.push(from);
          nextAttrs.push(interpolateAt(snap, v, prev, tByKey.get(offsetKey(v, prev)) ?? 0, ctx));
          nextLoop.push(to);
          nextAttrs.push(interpolateAt(snap, v, next, tByKey.get(offsetKey(v, next)) ?? 0, ctx));
        } else {
          const id = miterAt(v, prev, next);
          nextLoop.push(id);
          nextAttrs.push(interpolateAt(snap, v, next, tByKey.get(offsetKey(v, next)) ?? 0, ctx));
        }
      } else if (nextSelected) {
        const id = offsetToward(v, prev);
        nextLoop.push(id);
        nextAttrs.push(interpolateAt(snap, v, prev, tByKey.get(offsetKey(v, prev)) ?? 0, ctx));
      } else if (prevSelected) {
        const id = offsetToward(v, next);
        nextLoop.push(id);
        nextAttrs.push(interpolateAt(snap, v, next, tByKey.get(offsetKey(v, next)) ?? 0, ctx));
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
    const deduped = dedupeConsecutive(nextLoop, nextAttrs);
    rebuiltLoops.push({
      sourceFaceId,
      loop: deduped.loop,
      attrs: deduped.attrs,
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
    const sourceAttrs = sourceFace?.corners ?? [];
    for (let k = 0; k < segments; k += 1) {
      const quad = [ringEnd[k]!, ringStart[k]!, ringStart[k + 1]!, ringEnd[k + 1]!];
      const uvs = chamferUvs(sourceAttrs, k, segments);
      const chamferId = builder.addFace(quad, {
        id: ctx.idFactory.face(),
        materialSlot: sourceFace?.materialSlot ?? 0,
        materialSlotId: sourceFace?.materialSlotId,
        isSmooth: segments > 1,
        ...(uvs ? { uvs } : {}),
      });
      mapping.createFace(chamferId, [plan.f1, plan.f2]);
      chamferFaceIds.push(chamferId);
    }
    mapping.deleteEdge(plan.edgeId);
    if (ctx.attributes.preserveSeams || ctx.attributes.preserveSharps) {
      transferEdgeAttributes(mesh, plan, vA1, vB1, vA2, vB2, ctx);
    }
  }

  for (const decision of input.cornerDecisions.values()) {
    if (decision.kind !== "clip") {
      continue;
    }
    const clipId = addClipFace({
      builder,
      mesh,
      ctx,
      mapping,
      plans,
      decision,
      endpointOnFace,
      faceSnapshots,
    });
    if (clipId) {
      clipFaceIds.push(clipId);
    }
  }

  return { chamferFaceIds, remainingFaceIds, clipFaceIds, mapping };
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

function chamferUvs(
  corners: readonly CornerAttributes[],
  segment: number,
  segments: number,
): [number, number][] | undefined {
  if (!hasAnyUv(corners)) {
    return undefined;
  }
  const first = corners[0]?.uv;
  const last = corners[corners.length - 1]?.uv;
  if (!first || !last) {
    return undefined;
  }
  const t0 = segment / segments;
  const t1 = (segment + 1) / segments;
  const a: [number, number] = [first[0] + (last[0] - first[0]) * t0, first[1] + (last[1] - first[1]) * t0];
  const b: [number, number] = [first[0] + (last[0] - first[0]) * t1, first[1] + (last[1] - first[1]) * t1];
  return [a, b, b, a];
}

function addClipFace(input: {
  builder: MeshBuilder;
  mesh: HalfEdgeMesh;
  ctx: MeshOperationContext;
  mapping: TopologyMappingBuilder;
  plans: readonly SelectedEdgePlan[];
  decision: CornerDecision;
  endpointOnFace: (
    loop: readonly VertexId[],
    vertex: VertexId,
    edgeA: VertexId,
    edgeB: VertexId,
  ) => VertexId;
  faceSnapshots: ReadonlyArray<{
    sourceFaceId: FaceId;
    loop: readonly VertexId[];
    materialSlot: number;
  }>;
}): FaceId | null {
  const incident = input.plans.filter(
    (plan) => plan.a === input.decision.vertexId || plan.b === input.decision.vertexId,
  );
  if (incident.length !== 2) {
    return null;
  }
  const shared = input.decision.sharedFaceId;
  const snap = input.faceSnapshots.find((item) => item.sourceFaceId === shared);
  if (!snap) {
    return null;
  }
  const p = input.endpointOnFace(
    snap.loop,
    input.decision.vertexId,
    incident[0]!.a,
    incident[0]!.b,
  );
  const q = input.endpointOnFace(
    snap.loop,
    input.decision.vertexId,
    incident[1]!.a,
    incident[1]!.b,
  );
  if (p === q) {
    return null;
  }
  const otherFace = (plan: SelectedEdgePlan): FaceId => (plan.f1 === shared ? plan.f2 : plan.f1);
  const snap0 = input.faceSnapshots.find((item) => item.sourceFaceId === otherFace(incident[0]!));
  const snap1 = input.faceSnapshots.find((item) => item.sourceFaceId === otherFace(incident[1]!));
  if (!snap0 || !snap1) {
    return null;
  }
  const o0 = input.endpointOnFace(snap0.loop, input.decision.vertexId, incident[0]!.a, incident[0]!.b);
  const o1 = input.endpointOnFace(snap1.loop, input.decision.vertexId, incident[1]!.a, incident[1]!.b);
  const loop = o0 === o1 ? [p, q, o0] : [p, q, o1, o0];
  try {
    const id = input.builder.addFace(loop, {
      id: input.ctx.idFactory.face(),
      materialSlot: snap.materialSlot,
      isSmooth: false,
    });
    input.mapping.createFace(id, [shared]);
    return id;
  } catch {
    return null;
  }
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
