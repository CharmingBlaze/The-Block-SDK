import type { VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { polygonArea } from "../../polygon-triangulation";
import type { SelectedEdgePlan } from "./types";

export function sameUndirected(a: VertexId, b: VertexId, c: VertexId, d: VertexId): boolean {
  return (a === c && b === d) || (a === d && b === c);
}

export function edgeOnLoop(loop: readonly VertexId[], a: VertexId, b: VertexId): boolean {
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

export function otherNeighbor(loop: readonly VertexId[], vertex: VertexId, not: VertexId): VertexId {
  const i = loop.indexOf(vertex);
  if (i < 0) {
    throw new RangeError("Vertex is not on the face loop");
  }
  const n = loop.length;
  const prev = loop[(i - 1 + n) % n]!;
  const next = loop[(i + 1) % n]!;
  return next === not ? prev : next;
}

export function vertexPos(mesh: HalfEdgeMesh, id: VertexId): Vector3 {
  const p = mesh.vertices.get(id)!.position;
  return new Vector3(p[0], p[1], p[2]);
}

export function edgeLength(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): number {
  const pa = mesh.vertices.get(a)!.position;
  const pb = mesh.vertices.get(b)!.position;
  return Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
}

export function isBeveledVertex(vertex: VertexId, plans: readonly SelectedEdgePlan[]): boolean {
  return plans.some((plan) => plan.a === vertex || plan.b === vertex);
}

export function selectedDegree(vertex: VertexId, plans: readonly SelectedEdgePlan[]): number {
  let count = 0;
  for (const plan of plans) {
    if (plan.a === vertex || plan.b === vertex) {
      count += 1;
    }
  }
  return count;
}

export function selectedNeighbors(vertex: VertexId, plans: readonly SelectedEdgePlan[]): VertexId[] {
  const neighbors: VertexId[] = [];
  for (const plan of plans) {
    if (plan.a === vertex) {
      neighbors.push(plan.b);
    } else if (plan.b === vertex) {
      neighbors.push(plan.a);
    }
  }
  return neighbors;
}

export function faceIsDegenerate(mesh: HalfEdgeMesh, faceId: Parameters<HalfEdgeMesh["getFaceVertices"]>[0]): boolean {
  const loop = mesh.getFaceVertices(faceId);
  if (loop.length < 3) {
    return true;
  }
  return polygonArea(loop.map((id) => mesh.vertices.get(id)!.position)) <= 1e-12;
}

export function alongChamfer(
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

export function dedupeConsecutive<T>(
  loop: readonly VertexId[],
  attrs: readonly T[],
): { loop: VertexId[]; attrs: T[] } {
  const nextLoop: VertexId[] = [];
  const nextAttrs: T[] = [];
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

export function countFacesUsingEdge(mesh: HalfEdgeMesh, edgeId: SelectedEdgePlan["edgeId"]): number {
  let count = 0;
  for (const [faceId] of mesh.faces) {
    if (mesh.getFaceEdges(faceId).includes(edgeId)) {
      count += 1;
    }
  }
  return count;
}
