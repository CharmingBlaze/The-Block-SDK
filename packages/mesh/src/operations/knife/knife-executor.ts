import { cloneMesh } from "../../serialize";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { TopologyMappingBuilder } from "../../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "../contract";
import { runTransactionalMeshOp } from "../contract";
import { cutFace } from "../cut-face";
import {
  meshSnapRadius,
  planKnifeStroke,
  snapKnifePoint,
  type KnifeCutPlan,
  type KnifePlan,
  type KnifePlanRequest,
  type PlannedCut,
} from "./knife-planner";

export interface KnifeExecuteResult extends MeshOperationResult {
  readonly cutCount: number;
  readonly plan: KnifePlan;
  readonly cutPlan: KnifeCutPlan;
}

export function executeKnifeCutPlan(
  mesh: HalfEdgeMesh,
  plan: KnifeCutPlan,
  ctx: MeshOperationContext,
): KnifeExecuteResult {
  return runTransactionalMeshOp(mesh, () => executeKnifeCutPlanUnlocked(mesh, plan, ctx));
}

function executeKnifeCutPlanUnlocked(
  mesh: HalfEdgeMesh,
  plan: KnifeCutPlan,
  ctx: MeshOperationContext,
): KnifeExecuteResult {
  const start = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  const warnings = [...plan.warnings];
  let cutCount = 0;
  const snapRadius = meshSnapRadius(mesh);
  const snapshots = plan.cuts.map((cut) => ({
    from: endpointPoint(mesh, cut.start),
    to: endpointPoint(mesh, cut.end),
  }));

  for (let i = 0; i < plan.cuts.length; i += 1) {
    const cut = plan.cuts[i]!;
    const snap = snapshots[i]!;
    try {
      applyPlannedCut(mesh, cut, snap.from, snap.to, snapRadius, ctx);
      cutCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "knife cut failed";
      if (ctx.validation === "strict" && !/existing edge|same vertex|degenerate/.test(message)) {
        throw error;
      }
      warnings.push({ code: "knife-cut-skipped", message });
    }
  }

  mapping.snapshotNewElements(start, mesh);
  const { mapping: topology, changes } = mapping.build(mesh);
  const legacy: KnifePlan = {
    hits: [],
    cuts: plan.cuts.map((cut) => ({ faceId: cut.faceId, from: cut.start, to: cut.end })),
    warnings,
  };
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: [...topology.faces.created] },
    warnings,
    cutCount,
    plan: legacy,
    cutPlan: { cuts: plan.cuts, warnings },
  };
}

export function executeKnifePlan(
  mesh: HalfEdgeMesh,
  request: KnifePlanRequest,
  ctx: MeshOperationContext,
): KnifeExecuteResult {
  const start = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  const plan = planKnifeStroke(mesh, request, ctx);
  const cutPlan: KnifeCutPlan = {
    cuts: plan.cuts.map((cut) => ({ faceId: cut.faceId, start: cut.from, end: cut.to })),
    warnings: plan.warnings,
  };
  const executed = executeKnifeCutPlan(mesh, cutPlan, ctx);
  mapping.snapshotNewElements(start, mesh);
  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    ...executed,
    changes,
    mapping: topology,
    plan,
    cutPlan,
  };
}

function applyPlannedCut(
  mesh: HalfEdgeMesh,
  cut: PlannedCut,
  fromPoint: [number, number, number],
  toPoint: [number, number, number],
  snapRadius: number,
  ctx: MeshOperationContext,
): void {
  if (mesh.faces.has(cut.faceId)) {
    try {
      cutFace(mesh, { faceId: cut.faceId, from: cut.start, to: cut.end }, ctx);
      return;
    } catch {
      // Fall through to geometric re-snap after topology changed.
    }
  }
  const fromHit = snapKnifePoint(mesh, fromPoint, snapRadius);
  const toHit = snapKnifePoint(mesh, toPoint, snapRadius);
  if (!fromHit || !toHit) {
    throw new RangeError("A knife hit could not be re-snapped after earlier cuts");
  }
  const pair = planKnifeStroke(mesh, { points: [fromHit.point, toHit.point], snapRadius }, ctx);
  const next = pair.cuts[0];
  if (!next) {
    throw new RangeError(pair.warnings[0]?.message ?? "knife cut failed");
  }
  cutFace(mesh, { faceId: next.faceId, from: next.from, to: next.to }, ctx);
}

function endpointPoint(
  mesh: HalfEdgeMesh,
  endpoint: PlannedCut["start"],
): [number, number, number] {
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
