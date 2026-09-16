import type { FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { faceNormal } from "../../internal/delete-face";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";
import { selectedNeighbors, vertexPos } from "./geometry";
import type { CornerMiterKind, SelectedEdgePlan, SimpleBevelMiterMode } from "./types";
import { DEFAULT_MITER_LIMIT } from "./types";
import { offsetKey } from "./width";

export interface CornerDecision {
  readonly vertexId: VertexId;
  readonly kind: CornerMiterKind;
  readonly towardA: VertexId;
  readonly towardB: VertexId;
  readonly sharedFaceId: FaceId;
  readonly position?: [number, number, number];
}

function sharedFace(a: SelectedEdgePlan, b: SelectedEdgePlan): FaceId | null {
  for (const face of [a.f1, a.f2]) {
    if (face === b.f1 || face === b.f2) {
      return face;
    }
  }
  return null;
}

function plansAt(vertex: VertexId, plans: readonly SelectedEdgePlan[]): SelectedEdgePlan[] {
  return plans.filter((plan) => plan.a === vertex || plan.b === vertex);
}

function isConcaveCorner(mesh: HalfEdgeMesh, faceId: FaceId, vertex: VertexId): boolean {
  const loop = mesh.getFaceVertices(faceId);
  const i = loop.indexOf(vertex);
  if (i < 0) {
    return false;
  }
  const prev = loop[(i - 1 + loop.length) % loop.length]!;
  const next = loop[(i + 1) % loop.length]!;
  const origin = vertexPos(mesh, vertex);
  const a = vertexPos(mesh, prev).sub(origin);
  const b = vertexPos(mesh, next).sub(origin);
  const normal = faceNormal(mesh, faceId);
  return a.cross(b).dot(normal) < 0;
}

function intersectLines(
  p1: Vector3,
  d1: Vector3,
  p2: Vector3,
  d2: Vector3,
  epsilon: number,
): Vector3 | null {
  const n = d1.cross(d2);
  const denom = n.dot(n);
  if (denom <= epsilon * epsilon) {
    return null;
  }
  const r = p2.sub(p1);
  const s = r.cross(d2).dot(n) / denom;
  const point = p1.add(d1.scale(s));
  if (![point.x, point.y, point.z].every(Number.isFinite)) {
    return null;
  }
  return point;
}

function concaveIntersection(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  vertex: VertexId,
  width: number,
  epsilon: number,
): Vector3 | null {
  const loop = mesh.getFaceVertices(faceId);
  const i = loop.indexOf(vertex);
  if (i < 0) {
    return null;
  }
  const prev = loop[(i - 1 + loop.length) % loop.length]!;
  const next = loop[(i + 1) % loop.length]!;
  const v = vertexPos(mesh, vertex);
  const pPrev = vertexPos(mesh, prev);
  const pNext = vertexPos(mesh, next);
  const normal = faceNormal(mesh, faceId);
  const d1 = v.sub(pPrev);
  const d2 = pNext.sub(v);
  if (d1.length() <= epsilon || d2.length() <= epsilon) {
    return null;
  }
  const n1 = d1.scale(1 / d1.length());
  const n2 = d2.scale(1 / d2.length());
  const inward1 = normal.cross(n1);
  const inward2 = normal.cross(n2);
  if (inward1.length() <= epsilon || inward2.length() <= epsilon) {
    return null;
  }
  const o1 = pPrev.add(inward1.scale(width / inward1.length()));
  const o2 = v.add(inward2.scale(width / inward2.length()));
  return intersectLines(o1, n1, o2, n2, epsilon);
}

export function planCornerMiters(input: {
  mesh: HalfEdgeMesh;
  plans: readonly SelectedEdgePlan[];
  requestedWidth: number;
  tByPair: ReadonlyMap<string, number>;
  miterMode: SimpleBevelMiterMode;
  allowClipFallback: boolean;
  miterLimit: number;
  ctx: MeshOperationContext;
}): { decisions: Map<VertexId, CornerDecision>; warnings: MeshOperationWarning[] } {
  const { mesh, plans, requestedWidth, tByPair, miterMode, allowClipFallback, miterLimit, ctx } = input;
  const warnings: MeshOperationWarning[] = [];
  const decisions = new Map<VertexId, CornerDecision>();
  const seen = new Set<VertexId>();

  for (const plan of plans) {
    for (const vertex of [plan.a, plan.b]) {
      if (seen.has(vertex)) {
        continue;
      }
      seen.add(vertex);
      const incident = plansAt(vertex, plans);
      if (incident.length !== 2) {
        continue;
      }
      const neighbors = selectedNeighbors(vertex, incident);
      const towardA = neighbors[0]!;
      const towardB = neighbors[1]!;
      const shared = sharedFace(incident[0]!, incident[1]!);
      if (!shared) {
        throw new RangeError(`unsupported-bevel-junction: Vertex ${vertex} has no shared face`);
      }
      if (miterMode === "clip") {
        decisions.set(vertex, {
          vertexId: vertex,
          kind: "clip",
          towardA,
          towardB,
          sharedFaceId: shared,
        });
        continue;
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
      const tA = tByPair.get(offsetKey(vertex, towardA)) ?? Math.min(0.45, requestedWidth / la);
      const tB = tByPair.get(offsetKey(vertex, towardB)) ?? Math.min(0.45, requestedWidth / lb);
      if (tA <= 0 || tB <= 0 || tA >= 1 || tB >= 1) {
        throw new RangeError(`unsupported-complex-concave-miter: Corner ${vertex} inverts adjacent edges`);
      }

      let position: [number, number, number] = [
        origin[0] + da[0] * tA + db[0] * tB,
        origin[1] + da[1] * tA + db[1] * tB,
        origin[2] + da[2] * tA + db[2] * tB,
      ];
      if (isConcaveCorner(mesh, shared, vertex)) {
        const hit = concaveIntersection(mesh, shared, vertex, requestedWidth, ctx.tolerance.epsilon);
        if (!hit) {
          if (allowClipFallback) {
            warnings.push({
              code: "bevel-clip-fallback",
              message: `Sharp miter at vertex ${vertex} was unsafe; clip fallback was applied`,
              elementIds: [vertex],
            });
            decisions.set(vertex, {
              vertexId: vertex,
              kind: "clip",
              towardA,
              towardB,
              sharedFaceId: shared,
            });
            continue;
          }
          throw new RangeError(`unsupported-complex-concave-miter: Corner ${vertex} has no valid offset intersection`);
        }
        position = [hit.x, hit.y, hit.z];
      }

      const miterDistance = Math.hypot(
        position[0] - origin[0],
        position[1] - origin[1],
        position[2] - origin[2],
      );
      const limit = miterLimit > 0 ? miterLimit : DEFAULT_MITER_LIMIT;
      const worldWidth = Math.max(tA * la, tB * lb, ctx.tolerance.epsilon);
      if (worldWidth > 0 && miterDistance / worldWidth > limit + ctx.tolerance.epsilon) {
        if (allowClipFallback) {
          warnings.push({
            code: "bevel-clip-fallback",
            message: `Sharp miter at vertex ${vertex} exceeded miter limit ${limit}; clip fallback was applied`,
            elementIds: [vertex],
          });
          decisions.set(vertex, {
            vertexId: vertex,
            kind: "clip",
            towardA,
            towardB,
            sharedFaceId: shared,
          });
          continue;
        }
        throw new RangeError(
          `miter-limit: Sharp miter at vertex ${vertex} exceeds miter limit ${limit}`,
        );
      }
      if (![...position].every(Number.isFinite)) {
        throw new RangeError(`unsupported-complex-concave-miter: Corner ${vertex} produced a non-finite miter`);
      }
      decisions.set(vertex, {
        vertexId: vertex,
        kind: "sharp",
        towardA,
        towardB,
        sharedFaceId: shared,
        position,
      });
    }
  }

  return { decisions, warnings };
}
