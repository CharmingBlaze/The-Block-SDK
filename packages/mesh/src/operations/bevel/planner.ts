import type { EdgeId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { MeshOperationContext } from "../contract";
import {
  countFacesUsingEdge,
  edgeLength,
  faceIsDegenerate,
  otherNeighbor,
  selectedDegree,
} from "./geometry";
import type { BevelComponent, BevelComponentKind, SelectedEdgePlan } from "./types";

export interface BevelSelectionPlan {
  readonly plans: readonly SelectedEdgePlan[];
  readonly components: readonly BevelComponent[];
  readonly vertexDegree: ReadonlyMap<VertexId, number>;
}

export function planBevelSelection(
  mesh: HalfEdgeMesh,
  edgeIds: readonly EdgeId[],
  ctx: MeshOperationContext,
): BevelSelectionPlan {
  if (edgeIds.length === 0) {
    throw new RangeError("bevelEdges requires at least one edge");
  }
  const selected = new Set<EdgeId>();
  const plans: SelectedEdgePlan[] = [];

  for (const edgeId of edgeIds) {
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
    if (countFacesUsingEdge(mesh, edgeId) !== 2) {
      throw new RangeError(`non-manifold-edge: Edge ${edgeId} is not a manifold interior edge`);
    }
    if (faceIsDegenerate(mesh, f1) || faceIsDegenerate(mesh, f2)) {
      throw new RangeError(`degenerate-adjacent-face: Edge ${edgeId} has a degenerate adjacent face`);
    }
    const [a, b] = ends;
    if (edgeLength(mesh, a, b) <= ctx.tolerance.epsilon) {
      throw new RangeError(`Cannot bevel a degenerate edge ${edgeId}`);
    }
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
      edgeRecord: {
        ...edgeRecord,
        seamChannels: edgeRecord.seamChannels ? [...edgeRecord.seamChannels] : undefined,
      },
    });
    selected.add(edgeId);
  }

  const vertexDegree = new Map<VertexId, number>();
  for (const plan of plans) {
    vertexDegree.set(plan.a, (vertexDegree.get(plan.a) ?? 0) + 1);
    vertexDegree.set(plan.b, (vertexDegree.get(plan.b) ?? 0) + 1);
  }
  for (const [vertexId, degree] of vertexDegree) {
    if (degree >= 3) {
      throw new RangeError(
        `unsupported-bevel-junction: Vertex ${vertexId} has ${degree} selected bevel edges`,
      );
    }
  }

  return {
    plans,
    components: connectedComponents(plans),
    vertexDegree,
  };
}

function connectedComponents(plans: readonly SelectedEdgePlan[]): BevelComponent[] {
  const remaining = new Set(plans.map((plan) => plan.edgeId));
  const byEdge = new Map(plans.map((plan) => [plan.edgeId, plan]));
  const incident = new Map<VertexId, SelectedEdgePlan[]>();
  for (const plan of plans) {
    const a = incident.get(plan.a) ?? [];
    a.push(plan);
    incident.set(plan.a, a);
    const b = incident.get(plan.b) ?? [];
    b.push(plan);
    incident.set(plan.b, b);
  }
  const components: BevelComponent[] = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value as EdgeId;
    const edgeIds: EdgeId[] = [];
    const vertices = new Set<VertexId>();
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const edgeId = queue.pop()!;
      edgeIds.push(edgeId);
      const plan = byEdge.get(edgeId)!;
      vertices.add(plan.a);
      vertices.add(plan.b);
      for (const vertex of [plan.a, plan.b]) {
        for (const other of incident.get(vertex) ?? []) {
          if (remaining.has(other.edgeId)) {
            remaining.delete(other.edgeId);
            queue.push(other.edgeId);
          }
        }
      }
    }
    const vertexIds = [...vertices];
    const degrees = vertexIds.map((id) => selectedDegree(id, plans.filter((plan) => edgeIds.includes(plan.edgeId))));
    const kind: BevelComponentKind =
      edgeIds.length === 1
        ? "isolated"
        : degrees.every((degree) => degree === 2)
          ? "closed-loop"
          : "open-chain";
    components.push({ kind, edgeIds, vertexIds });
  }
  return components;
}
