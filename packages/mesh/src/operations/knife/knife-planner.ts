import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3, type Vec3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { faceNormal } from "../../internal/delete-face";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";
import type { CutEndpoint } from "../cut-face";

export type Vec3Tuple = readonly [number, number, number];

export interface KnifePoint {
  readonly faceId: FaceId;
  readonly position: Vec3;
  readonly attachment:
    | { readonly type: "vertex"; readonly vertexId: VertexId }
    | { readonly type: "edge"; readonly edgeId: EdgeId; readonly t: number }
    | { readonly type: "face" };
}

export interface PlannedCut {
  readonly faceId: FaceId;
  readonly start: CutEndpoint;
  readonly end: CutEndpoint;
}

export interface KnifeCutPlan {
  readonly cuts: readonly PlannedCut[];
  readonly warnings: readonly MeshOperationWarning[];
}

export interface KnifePlanRequest {
  readonly points: readonly Vec3Tuple[];
  readonly snapRadius?: number;
}

export interface KnifePlanHit {
  readonly point: Vec3Tuple;
  readonly endpoint: CutEndpoint;
  readonly faceIds: readonly FaceId[];
}

export interface KnifePlanCut {
  readonly faceId: FaceId;
  readonly from: CutEndpoint;
  readonly to: CutEndpoint;
}

export interface KnifePlan {
  readonly hits: readonly KnifePlanHit[];
  readonly cuts: readonly KnifePlanCut[];
  readonly warnings: readonly MeshOperationWarning[];
}

export function cutEndpointPoint(mesh: HalfEdgeMesh, endpoint: CutEndpoint): Vec3Tuple {
  if (endpoint.kind === "vertex") {
    const p = mesh.vertices.get(endpoint.vertexId)?.position;
    return p ? [p[0], p[1], p[2]] : [0, 0, 0];
  }
  const ends = mesh.getEdgeVertices(endpoint.edgeId);
  if (!ends) {
    return [0, 0, 0];
  }
  const a = mesh.vertices.get(ends[0])!.position;
  const b = mesh.vertices.get(ends[1])!.position;
  const t = endpoint.t;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function planKnifeCuts(
  mesh: HalfEdgeMesh,
  points: readonly KnifePoint[],
  _ctx: MeshOperationContext,
): KnifeCutPlan {
  if (points.length < 2) {
    throw new RangeError("planKnifeCuts requires at least two points");
  }
  const warnings: MeshOperationWarning[] = [];
  const cuts: PlannedCut[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    cuts.push(...planPair(mesh, points[i]!, points[i + 1]!, warnings));
  }
  return { cuts, warnings };
}

export function meshSnapRadius(mesh: HalfEdgeMesh, fraction = 0.04): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const vertex of mesh.vertices.values()) {
    const [x, y, z] = vertex.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) {
    return 0.15;
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  return Math.max(diagonal * fraction, 1e-4);
}

export function planKnifeStroke(
  mesh: HalfEdgeMesh,
  request: KnifePlanRequest,
  ctx: MeshOperationContext,
): KnifePlan {
  if (request.points.length < 2) {
    throw new RangeError("planKnifeStroke requires at least two points");
  }
  const snapRadius = request.snapRadius ?? meshSnapRadius(mesh);
  const warnings: MeshOperationWarning[] = [];
  const hits: KnifePlanHit[] = [];
  for (const point of request.points) {
    const hit = snapKnifePoint(mesh, point, snapRadius);
    if (!hit) {
      warnings.push({
        code: "knife-miss",
        message: `No vertex or edge near [${point.join(", ")}]`,
      });
      continue;
    }
    const last = hits[hits.length - 1];
    if (
      last &&
      Math.abs(last.point[0] - hit.point[0]) < 1e-9 &&
      Math.abs(last.point[1] - hit.point[1]) < 1e-9 &&
      Math.abs(last.point[2] - hit.point[2]) < 1e-9
    ) {
      continue;
    }
    hits.push(hit);
  }

  const knifePoints: KnifePoint[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i]!;
    const other = i < hits.length - 1 ? hits[i + 1]! : hits[i - 1];
    const faceId = other ? chooseFace(hit, other) : hit.faceIds[0];
    if (!faceId) {
      continue;
    }
    knifePoints.push(hitToKnifePoint(hit, faceId));
  }

  if (knifePoints.length >= 2) {
    const cutPlan = planKnifeCuts(mesh, knifePoints, ctx);
    warnings.push(...cutPlan.warnings);
    return {
      hits,
      cuts: cutPlan.cuts.map((cut) => ({ faceId: cut.faceId, from: cut.start, to: cut.end })),
      warnings,
    };
  }

  return { hits, cuts: [], warnings };
}

export function snapKnifePoint(
  mesh: HalfEdgeMesh,
  point: Vec3Tuple,
  snapRadius: number,
): KnifePlanHit | null {
  const p = new Vector3(point[0], point[1], point[2]);
  let bestVertex: { id: VertexId; dist: number; position: Vec3Tuple } | null = null;
  for (const [id, vertex] of mesh.vertices) {
    const dist = p.distanceTo(
      new Vector3(vertex.position[0], vertex.position[1], vertex.position[2]),
    );
    if (dist <= snapRadius && (!bestVertex || dist < bestVertex.dist)) {
      bestVertex = { id, dist, position: [...vertex.position] };
    }
  }
  let bestEdge: { id: EdgeId; t: number; dist: number; point: Vec3Tuple } | null = null;
  for (const [id] of mesh.edges) {
    const ends = mesh.getEdgeVertices(id);
    if (!ends) {
      continue;
    }
    const a = mesh.vertices.get(ends[0])!.position;
    const b = mesh.vertices.get(ends[1])!.position;
    const av = new Vector3(a[0], a[1], a[2]);
    const bv = new Vector3(b[0], b[1], b[2]);
    const closest = closestOnSegment(p, av, bv);
    let t = closest.t;
    let pointOn = closest.point;
    let dist = closest.dist;
    const length = av.distanceTo(bv);
    if (length > 1e-12 && Math.abs(t - 0.5) * length <= snapRadius) {
      t = 0.5;
      const mid = av.lerp(bv, 0.5);
      pointOn = [mid.x, mid.y, mid.z];
      dist = p.distanceTo(mid);
    }
    if (dist <= snapRadius && (!bestEdge || dist < bestEdge.dist)) {
      bestEdge = { id, t, dist, point: pointOn };
    }
  }

  if (bestVertex && (!bestEdge || bestVertex.dist <= bestEdge.dist)) {
    return {
      point: bestVertex.position,
      endpoint: { kind: "vertex", vertexId: bestVertex.id },
      faceIds: mesh.getVertexFaces(bestVertex.id),
    };
  }
  if (bestEdge) {
    if (bestEdge.t <= 1e-6 || bestEdge.t >= 1 - 1e-6) {
      const ends = mesh.getEdgeVertices(bestEdge.id)!;
      const vertexId = bestEdge.t < 0.5 ? ends[0] : ends[1];
      const position = mesh.vertices.get(vertexId)!.position;
      return {
        point: [...position],
        endpoint: { kind: "vertex", vertexId },
        faceIds: mesh.getVertexFaces(vertexId),
      };
    }
    const [f1, f2] = mesh.getEdgeFaces(bestEdge.id);
    return {
      point: bestEdge.point,
      endpoint: { kind: "edge", edgeId: bestEdge.id, t: bestEdge.t },
      faceIds: [f1, f2].filter((id): id is FaceId => id !== null && id !== undefined),
    };
  }

  return snapToNearestFaceEdge(mesh, p, snapRadius);
}

function planPair(
  mesh: HalfEdgeMesh,
  a: KnifePoint,
  b: KnifePoint,
  warnings: MeshOperationWarning[],
): PlannedCut[] {
  if (a.faceId === b.faceId) {
    const clipped = clipLineToFaceBoundary(mesh, a.faceId, vec3(a.position), vec3(b.position));
    if (clipped.length === 2) {
      const start = clipped[0]!;
      const end = clipped[1]!;
      if (sameEndpoint(start, end) || isExistingBoundaryEdge(mesh, a.faceId, start, end)) {
        warnings.push({
          code: "knife-existing-edge",
          message: "Knife segment lies on an existing edge",
          elementIds: [a.faceId],
        });
        return [];
      }
      return [{ faceId: a.faceId, start, end }];
    }
  }

  const start = endpointFromPoint(mesh, a);
  const end = endpointFromPoint(mesh, b);
  if (sameEndpoint(start, end)) {
    return [];
  }
  if (a.faceId === b.faceId) {
    if (isExistingBoundaryEdge(mesh, a.faceId, start, end)) {
      warnings.push({
        code: "knife-existing-edge",
        message: "Knife segment lies on an existing edge",
        elementIds: [a.faceId],
      });
      return [];
    }
    return [{ faceId: a.faceId, start, end }];
  }
  return traceSurface(mesh, a, b, start, end, warnings);
}

function traceSurface(
  mesh: HalfEdgeMesh,
  a: KnifePoint,
  b: KnifePoint,
  start: CutEndpoint,
  end: CutEndpoint,
  warnings: MeshOperationWarning[],
): PlannedCut[] {
  const shared = sharedEdges(mesh, a.faceId, b.faceId);
  if (shared.length > 0) {
    const edgeId = pickCrossingEdge(mesh, shared, a.position, b.position);
    const t = closestTOnEdge(mesh, edgeId, a.position, b.position);
    const mid: CutEndpoint = { kind: "edge", edgeId, t };
    if (isExistingBoundaryEdge(mesh, a.faceId, start, mid) || isExistingBoundaryEdge(mesh, b.faceId, mid, end)) {
      warnings.push({
        code: "knife-existing-edge",
        message: "Knife path lies on existing edges",
        elementIds: [a.faceId, b.faceId],
      });
      return [];
    }
    return [
      { faceId: a.faceId, start, end: mid },
      { faceId: b.faceId, start: mid, end },
    ];
  }

  const p0 = vec3(a.position);
  const p1 = vec3(b.position);
  const cuts: PlannedCut[] = [];
  let faceId = a.faceId;
  let from = start;
  const visited = new Set<string>();
  for (let step = 0; step < 32; step += 1) {
    if (faceId === b.faceId) {
      cuts.push({ faceId, start: from, end });
      return cuts;
    }
    const cross = findForwardCrossing(mesh, faceId, p0, p1, from);
    if (!cross) {
      warnings.push({
        code: "knife-no-shared-face",
        message: "Consecutive knife hits do not share a surface path",
        elementIds: [a.faceId, b.faceId],
      });
      return cuts;
    }
    const mid: CutEndpoint = { kind: "edge", edgeId: cross.edgeId, t: cross.t };
    cuts.push({ faceId, start: from, end: mid });
    const [f1, f2] = mesh.getEdgeFaces(cross.edgeId);
    const next = f1 === faceId ? f2 : f1;
    if (!next) {
      warnings.push({
        code: "knife-boundary",
        message: "Knife path hit a boundary edge",
        elementIds: [cross.edgeId],
      });
      return cuts;
    }
    const key = `${next}:${cross.edgeId}`;
    if (visited.has(key)) {
      break;
    }
    visited.add(key);
    faceId = next;
    from = mid;
  }
  warnings.push({
    code: "knife-no-shared-face",
    message: "Knife path exceeded the face-walk limit",
    elementIds: [a.faceId, b.faceId],
  });
  return cuts;
}

function findForwardCrossing(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  p0: Vector3,
  p1: Vector3,
  from: CutEndpoint,
): { edgeId: EdgeId; t: number } | null {
  const skip = from.kind === "edge" ? from.edgeId : null;
  const edges = mesh.getFaceEdges(faceId);
  let best: { edgeId: EdgeId; t: number; tSeg: number } | null = null;
  for (const edgeId of edges) {
    if (skip === edgeId) {
      continue;
    }
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    const a = mesh.vertices.get(ends[0])!.position;
    const b = mesh.vertices.get(ends[1])!.position;
    const hit = closestBetweenSegments(
      p0,
      p1,
      new Vector3(a[0], a[1], a[2]),
      new Vector3(b[0], b[1], b[2]),
    );
    if (hit.dist > 1e-4 || hit.tSeg < 1e-5 || hit.tSeg > 1 - 1e-5) {
      continue;
    }
    if (!best || hit.tSeg < best.tSeg) {
      best = { edgeId, t: hit.tEdge, tSeg: hit.tSeg };
    }
  }
  return best ? { edgeId: best.edgeId, t: best.t } : null;
}

function sharedEdges(mesh: HalfEdgeMesh, faceA: FaceId, faceB: FaceId): EdgeId[] {
  const setB = new Set(mesh.getFaceEdges(faceB));
  return mesh.getFaceEdges(faceA).filter((id) => setB.has(id));
}

function pickCrossingEdge(
  mesh: HalfEdgeMesh,
  edges: readonly EdgeId[],
  a: Vec3,
  b: Vec3,
): EdgeId {
  let best = edges[0]!;
  let bestDist = Infinity;
  for (const edgeId of edges) {
    const t = closestTOnEdge(mesh, edgeId, a, b);
    const ends = mesh.getEdgeVertices(edgeId)!;
    const pa = mesh.vertices.get(ends[0])!.position;
    const pb = mesh.vertices.get(ends[1])!.position;
    const p = new Vector3(
      pa[0] + (pb[0] - pa[0]) * t,
      pa[1] + (pb[1] - pa[1]) * t,
      pa[2] + (pb[2] - pa[2]) * t,
    );
    const mid = new Vector3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
    const dist = p.distanceTo(mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = edgeId;
    }
  }
  return best;
}

function closestTOnEdge(mesh: HalfEdgeMesh, edgeId: EdgeId, a: Vec3, b: Vec3): number {
  const ends = mesh.getEdgeVertices(edgeId)!;
  const ea = mesh.vertices.get(ends[0])!.position;
  const eb = mesh.vertices.get(ends[1])!.position;
  const hit = closestBetweenSegments(
    vec3(a),
    vec3(b),
    new Vector3(ea[0], ea[1], ea[2]),
    new Vector3(eb[0], eb[1], eb[2]),
  );
  return Math.min(1 - 1e-3, Math.max(1e-3, hit.tEdge));
}

function closestBetweenSegments(
  p0: Vector3,
  p1: Vector3,
  q0: Vector3,
  q1: Vector3,
): { tSeg: number; tEdge: number; dist: number } {
  const u = p1.sub(p0);
  const v = q1.sub(q0);
  const w = p0.sub(q0);
  const uu = u.lengthSq();
  const vv = v.lengthSq();
  const uv = u.dot(v);
  const uw = u.dot(w);
  const vw = v.dot(w);
  const denom = uu * vv - uv * uv;
  let tSeg = 0;
  let tEdge = 0;
  if (Math.abs(denom) > 1e-18) {
    tSeg = Math.min(1, Math.max(0, (uv * vw - uw * vv) / denom));
  }
  if (vv > 1e-18) {
    tEdge = Math.min(1, Math.max(0, (uv * tSeg + vw) / vv));
  }
  if (uu > 1e-18) {
    tSeg = Math.min(1, Math.max(0, (uv * tEdge - uw) / uu));
  }
  const ps = p0.add(u.scale(tSeg));
  const qs = q0.add(v.scale(tEdge));
  return { tSeg, tEdge, dist: ps.distanceTo(qs) };
}

function endpointFromPoint(mesh: HalfEdgeMesh, point: KnifePoint): CutEndpoint {
  if (point.attachment.type === "vertex") {
    return { kind: "vertex", vertexId: point.attachment.vertexId };
  }
  if (point.attachment.type === "edge") {
    return { kind: "edge", edgeId: point.attachment.edgeId, t: point.attachment.t };
  }
  const hit = snapToNearestFaceEdge(
    mesh,
    new Vector3(point.position.x, point.position.y, point.position.z),
    Number.POSITIVE_INFINITY,
  );
  if (hit?.endpoint) {
    return hit.endpoint;
  }
  const edges = mesh.getFaceEdges(point.faceId);
  if (edges[0]) {
    return { kind: "edge", edgeId: edges[0], t: 0.5 };
  }
  throw new RangeError(`Knife point on face ${point.faceId} has no resolvable edge`);
}

function hitToKnifePoint(hit: KnifePlanHit, faceId: FaceId): KnifePoint {
  const position = { x: hit.point[0], y: hit.point[1], z: hit.point[2] };
  if (hit.endpoint.kind === "vertex") {
    return { faceId, position, attachment: { type: "vertex", vertexId: hit.endpoint.vertexId } };
  }
  return {
    faceId,
    position,
    attachment: { type: "edge", edgeId: hit.endpoint.edgeId, t: hit.endpoint.t },
  };
}

function chooseFace(hit: KnifePlanHit, other: KnifePlanHit): FaceId | undefined {
  const set = new Set(other.faceIds);
  const shared = hit.faceIds.filter((id) => set.has(id));
  return shared[0] ?? hit.faceIds[0];
}

function vec3(v: Vec3): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

function snapToNearestFaceEdge(
  mesh: HalfEdgeMesh,
  p: Vector3,
  snapRadius: number,
): KnifePlanHit | null {
  let best: {
    faceId: FaceId;
    edgeId: EdgeId;
    t: number;
    dist: number;
    point: Vec3Tuple;
    projected: Vec3Tuple;
  } | null = null;
  for (const [faceId] of mesh.faces) {
    const planeDist = Math.abs(signedDistanceToFace(mesh, faceId, p));
    if (planeDist > Math.max(snapRadius * 4, 0.35) && Number.isFinite(snapRadius)) {
      continue;
    }
    const projected = projectOntoFace(mesh, faceId, p);
    if (!pointInFace(mesh, faceId, projected)) {
      continue;
    }
    const edges = mesh.getFaceEdges(faceId);
    const loop = mesh.getFaceVertices(faceId);
    for (let i = 0; i < loop.length; i++) {
      const a = mesh.vertices.get(loop[i]!)!.position;
      const b = mesh.vertices.get(loop[(i + 1) % loop.length]!)!.position;
      const closest = closestOnSegment(
        projected,
        new Vector3(a[0], a[1], a[2]),
        new Vector3(b[0], b[1], b[2]),
      );
      if (!best || closest.dist < best.dist || (closest.dist === best.dist && planeDist < 1e-9)) {
        best = {
          faceId,
          edgeId: edges[i]!,
          t: closest.t,
          dist: closest.dist,
          point: closest.point,
          projected: [projected.x, projected.y, projected.z],
        };
      }
    }
  }
  if (!best) {
    return null;
  }
  const [f1, f2] = mesh.getEdgeFaces(best.edgeId);
  const faceIds = [f1, f2].filter((id): id is FaceId => id !== null && id !== undefined);
  if (best.dist <= snapRadius) {
    if (best.t <= 1e-6 || best.t >= 1 - 1e-6) {
      const ends = mesh.getEdgeVertices(best.edgeId)!;
      const vertexId = best.t < 0.5 ? ends[0] : ends[1];
      return {
        point: [...mesh.vertices.get(vertexId)!.position],
        endpoint: { kind: "vertex", vertexId },
        faceIds: mesh.getVertexFaces(vertexId),
      };
    }
    return {
      point: best.point,
      endpoint: { kind: "edge", edgeId: best.edgeId, t: best.t },
      faceIds,
    };
  }
  return {
    point: best.projected,
    endpoint: { kind: "edge", edgeId: best.edgeId, t: best.t },
    faceIds: faceIds.length > 0 ? faceIds : [best.faceId],
  };
}

function isExistingBoundaryEdge(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  from: CutEndpoint,
  to: CutEndpoint,
): boolean {
  if (from.kind !== "vertex" || to.kind !== "vertex") {
    return false;
  }
  const loop = mesh.getFaceVertices(faceId);
  const i = loop.indexOf(from.vertexId);
  const j = loop.indexOf(to.vertexId);
  if (i < 0 || j < 0) {
    return false;
  }
  const n = loop.length;
  const gap = Math.abs(i - j);
  return gap === 1 || gap === n - 1;
}

function sameEndpoint(a: CutEndpoint, b: CutEndpoint): boolean {
  if (a.kind === "vertex" && b.kind === "vertex") {
    return a.vertexId === b.vertexId;
  }
  if (a.kind === "edge" && b.kind === "edge") {
    return a.edgeId === b.edgeId && Math.abs(a.t - b.t) < 1e-9;
  }
  return false;
}

function closestOnSegment(
  p: Vector3,
  a: Vector3,
  b: Vector3,
): { t: number; point: Vec3Tuple; dist: number } {
  const u = b.sub(a);
  const len2 = u.lengthSq();
  const t = len2 <= 1e-18 ? 0 : Math.min(1, Math.max(0, p.sub(a).dot(u) / len2));
  const point = a.add(u.scale(t));
  return { t, point: [point.x, point.y, point.z], dist: p.distanceTo(point) };
}

function faceBasis(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
): { origin: Vector3; normal: Vector3; tangent: Vector3; bitangent: Vector3 } | null {
  const originId = mesh.getFaceVertices(faceId)[0];
  if (!originId) {
    return null;
  }
  const originPos = mesh.vertices.get(originId)!.position;
  const origin = new Vector3(originPos[0], originPos[1], originPos[2]);
  const normal = faceNormal(mesh, faceId);
  const axis = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const crossed = normal.cross(axis);
  const length = crossed.length();
  if (length <= 1e-12) {
    const other = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
    const retry = normal.cross(other);
    const retryLen = retry.length();
    if (retryLen <= 1e-12) {
      return null;
    }
    const tangent = retry.scale(1 / retryLen);
    return { origin, normal, tangent, bitangent: normal.cross(tangent) };
  }
  const tangent = crossed.scale(1 / length);
  return { origin, normal, tangent, bitangent: normal.cross(tangent) };
}

function clipLineToFaceBoundary(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  p0: Vector3,
  p1: Vector3,
): CutEndpoint[] {
  const basis = faceBasis(mesh, faceId);
  if (!basis) {
    return [];
  }
  const to2 = (q: Vector3): [number, number] => [
    q.sub(basis.origin).dot(basis.tangent),
    q.sub(basis.origin).dot(basis.bitangent),
  ];
  const a = to2(p0);
  const b = to2(p1);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 1e-10) {
    return [];
  }

  const loop = mesh.getFaceVertices(faceId);
  const edges = mesh.getFaceEdges(faceId);
  const hits: { tLine: number; endpoint: CutEndpoint; key: string }[] = [];

  for (let i = 0; i < loop.length; i++) {
    const edgeId = edges[i]!;
    const va = mesh.vertices.get(loop[i]!)!.position;
    const vb = mesh.vertices.get(loop[(i + 1) % loop.length]!)!.position;
    const c = to2(new Vector3(va[0], va[1], va[2]));
    const d = to2(new Vector3(vb[0], vb[1], vb[2]));
    const ex = d[0] - c[0];
    const ey = d[1] - c[1];
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) {
      continue;
    }
    const qx = c[0] - a[0];
    const qy = c[1] - a[1];
    const tLine = (qx * ey - qy * ex) / denom;
    const u = (qx * dy - qy * dx) / denom;
    if (u < -1e-6 || u > 1 + 1e-6) {
      continue;
    }
    const clampedU = Math.min(1, Math.max(0, u));
    let endpoint: CutEndpoint;
    let key: string;
    if (clampedU <= 1e-4) {
      endpoint = { kind: "vertex", vertexId: loop[i]! };
      key = `v:${loop[i]}`;
    } else if (clampedU >= 1 - 1e-4) {
      const vertexId = loop[(i + 1) % loop.length]!;
      endpoint = { kind: "vertex", vertexId };
      key = `v:${vertexId}`;
    } else {
      endpoint = { kind: "edge", edgeId, t: edgeParameter(mesh, edgeId, clampedU, loop[i]!) };
      key = `e:${edgeId}:${endpoint.t.toFixed(5)}`;
    }
    if (hits.some((hit) => hit.key === key)) {
      continue;
    }
    hits.push({ tLine, endpoint, key });
  }

  hits.sort((left, right) => left.tLine - right.tLine);
  if (hits.length < 2) {
    return [];
  }
  return [hits[0]!.endpoint, hits[hits.length - 1]!.endpoint];
}

function edgeParameter(mesh: HalfEdgeMesh, edgeId: EdgeId, uAlongLoop: number, loopFrom: VertexId): number {
  const ends = mesh.getEdgeVertices(edgeId);
  if (!ends) {
    return uAlongLoop;
  }
  return ends[0] === loopFrom ? uAlongLoop : 1 - uAlongLoop;
}

function signedDistanceToFace(mesh: HalfEdgeMesh, faceId: FaceId, p: Vector3): number {
  const originId = mesh.getFaceVertices(faceId)[0]!;
  const origin = mesh.vertices.get(originId)!.position;
  const n = faceNormal(mesh, faceId);
  return p.sub(new Vector3(origin[0], origin[1], origin[2])).dot(n);
}

function projectOntoFace(mesh: HalfEdgeMesh, faceId: FaceId, p: Vector3): Vector3 {
  const n = faceNormal(mesh, faceId);
  return p.sub(n.scale(signedDistanceToFace(mesh, faceId, p)));
}

function pointInFace(mesh: HalfEdgeMesh, faceId: FaceId, p: Vector3): boolean {
  const basis = faceBasis(mesh, faceId);
  if (!basis) {
    return false;
  }
  const to2 = (q: Vector3): [number, number] => [
    q.sub(basis.origin).dot(basis.tangent),
    q.sub(basis.origin).dot(basis.bitangent),
  ];
  const loop = mesh.getFaceVertices(faceId).map((id) => {
    const pos = mesh.vertices.get(id)!.position;
    return to2(new Vector3(pos[0], pos[1], pos[2]));
  });
  const pt = to2(p);
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!;
    const c = loop[j]!;
    const dy = c[1] - a[1];
    if (Math.abs(dy) < 1e-12) {
      continue;
    }
    const intersect =
      a[1] > pt[1] !== c[1] > pt[1] && pt[0] < ((c[0] - a[0]) * (pt[1] - a[1])) / dy + a[0];
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
