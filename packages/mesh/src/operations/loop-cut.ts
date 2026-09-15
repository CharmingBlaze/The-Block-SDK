import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export type LoopCutVec3 = readonly [number, number, number];

export interface LoopCutRequest {
  readonly startEdgeId: EdgeId;
  readonly factor?: number;
  readonly cuts?: number;
}

export interface OrientedLoopEdge {
  readonly edgeId: EdgeId;
  readonly from: VertexId;
  readonly to: VertexId;
}

export interface LoopCutPreview {
  readonly loopEdgeIds: readonly EdgeId[];
  readonly closed: boolean;
  readonly factors: readonly number[];
  readonly vertices: readonly LoopCutVec3[];
  readonly segments: readonly (readonly [LoopCutVec3, LoopCutVec3])[];
}

export interface LoopCutResult extends MeshOperationResult {
  readonly newVertexIds: VertexId[];
  readonly newFaceIds: FaceId[];
  readonly loopEdgeIds: EdgeId[];
}

export function collectQuadEdgeLoop(mesh: HalfEdgeMesh, startEdgeId: EdgeId): EdgeId[] {
  return collectOrientedQuadEdgeLoop(mesh, startEdgeId).map((edge) => edge.edgeId);
}

/**
 * Walks a quad edge ring until a boundary, a non-quad, a visited edge, or the start (closed ring).
 */
export function collectQuadEdgeRing(mesh: HalfEdgeMesh, startEdgeId: EdgeId): EdgeId[] {
  if (!mesh.edges.has(startEdgeId)) {
    throw new RangeError(`Edge ${startEdgeId} does not exist`);
  }
  const visited = new Set<EdgeId>([startEdgeId]);
  const ring: EdgeId[] = [startEdgeId];
  const [f1, f2] = mesh.getEdgeFaces(startEdgeId);
  extendRing(mesh, startEdgeId, f1, visited, ring);
  extendRing(mesh, startEdgeId, f2, visited, ring);
  return ring;
}

export function collectOrientedQuadEdgeLoop(
  mesh: HalfEdgeMesh,
  startEdgeId: EdgeId,
): OrientedLoopEdge[] {
  if (!mesh.edges.has(startEdgeId)) {
    throw new RangeError(`Edge ${startEdgeId} does not exist`);
  }
  const ends = mesh.getEdgeVertices(startEdgeId);
  if (!ends) {
    return [];
  }
  const visited = new Set<EdgeId>([startEdgeId]);
  const start: OrientedLoopEdge = { edgeId: startEdgeId, from: ends[0], to: ends[1] };
  const forward: OrientedLoopEdge[] = [];
  const backward: OrientedLoopEdge[] = [];
  const [f1, f2] = mesh.getEdgeFaces(startEdgeId);
  if (f1) {
    extendLoop(mesh, start, f1, visited, forward);
  }
  if (f2) {
    extendLoop(mesh, start, f2, visited, backward);
  }
  return [...backward.reverse(), start, ...forward];
}

export function previewLoopCut(
  mesh: HalfEdgeMesh,
  request: LoopCutRequest,
): LoopCutPreview {
  const oriented = collectOrientedQuadEdgeLoop(mesh, request.startEdgeId);
  const loopEdgeIds = oriented.map((edge) => edge.edgeId);
  const factors = loopCutFactors(request.cuts ?? 1, request.factor ?? 0.5);
  const closed = isClosedLoop(mesh, oriented);
  const vertices: LoopCutVec3[] = [];
  const segments: Array<readonly [LoopCutVec3, LoopCutVec3]> = [];
  for (const factor of factors) {
    const ring = oriented.map((edge) => interpolateEdge(mesh, edge, factor));
    vertices.push(...ring);
    for (let i = 0; i < ring.length - 1; i += 1) {
      segments.push([ring[i]!, ring[i + 1]!]);
    }
    if (closed && ring.length > 2) {
      segments.push([ring[ring.length - 1]!, ring[0]!]);
    }
  }
  return { loopEdgeIds, closed, factors, vertices, segments };
}

export function loopCut(
  mesh: HalfEdgeMesh,
  request: LoopCutRequest,
  ctx: MeshOperationContext,
): LoopCutResult {
  return runTransactionalMeshOp(mesh, () => loopCutUnlocked(mesh, request, ctx));
}

function loopCutUnlocked(
  mesh: HalfEdgeMesh,
  request: LoopCutRequest,
  ctx: MeshOperationContext,
): LoopCutResult {
  const oriented = collectOrientedQuadEdgeLoop(mesh, request.startEdgeId);
  const loopEdgeIds = oriented.map((edge) => edge.edgeId);
  if (loopEdgeIds.length < 2) {
    throw new RangeError("loopCut requires a quad edge loop of at least two edges");
  }
  const factors = loopCutFactors(request.cuts ?? 1, request.factor ?? 0.5);
  const mapping = new TopologyMappingBuilder(mesh);
  let builder = MeshBuilder.fromMesh(mesh);
  const splits = new Map<EdgeId, VertexId[]>();
  const newVertexIds: VertexId[] = [];
  const orientation = new Map(oriented.map((edge) => [edge.edgeId, edge]));

  for (const edge of oriented) {
    const ids: VertexId[] = [];
    for (const factor of factors) {
      const point = interpolateEdge(mesh, edge, factor);
      const id = ctx.idFactory.vertex();
      builder.addVertex(point[0], point[1], point[2], id);
      mapping.createVertex(id, [edge.from, edge.to]);
      ids.push(id);
      newVertexIds.push(id);
    }
    splits.set(edge.edgeId, ids);
  }

  const faces = new Set<FaceId>();
  for (const edgeId of loopEdgeIds) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (f1) faces.add(f1);
    if (f2) faces.add(f2);
  }

  const plans: Array<{
    faceId: FaceId;
    expanded: VertexId[];
    materialSlot: number;
    isSmooth: boolean;
    strip: boolean;
  }> = [];
  for (const faceId of faces) {
    const expanded = expandFaceForLoopCut(mesh, faceId, splits, orientation);
    if (!expanded || expanded.length < 3) {
      continue;
    }
    const edges = mesh.getFaceEdges(faceId);
    const loopCount = edges.filter((id) => splits.has(id)).length;
    const strips = stripQuads(expanded, factors.length);
    const strip = edges.length === 4 && loopCount === 2 && strips.length > 0;
    plans.push({
      faceId,
      expanded,
      materialSlot: mesh.faces.get(faceId)?.materialSlot ?? 0,
      isSmooth: mesh.faces.get(faceId)?.isSmooth ?? false,
      strip,
    });
  }

  for (const plan of plans) {
    deleteFace(mesh, plan.faceId);
    mapping.deleteFace(plan.faceId);
  }
  builder = MeshBuilder.fromMesh(mesh);
  const newFaceIds: FaceId[] = [];
  for (const plan of plans) {
    const replacement: FaceId[] = [];
    if (plan.strip) {
      const strips = stripQuads(plan.expanded, factors.length);
      for (const quad of strips) {
        const faceId = ctx.idFactory.face();
        builder.addFace(quad, {
          id: faceId,
          materialSlot: plan.materialSlot,
          isSmooth: plan.isSmooth,
        });
        mapping.createFace(faceId, [plan.faceId]);
        replacement.push(faceId);
        newFaceIds.push(faceId);
      }
    } else {
      const faceId = ctx.idFactory.face();
      builder.addFace(plan.expanded, {
        id: faceId,
        materialSlot: plan.materialSlot,
        isSmooth: plan.isSmooth,
      });
      mapping.createFace(faceId, [plan.faceId]);
      replacement.push(faceId);
      newFaceIds.push(faceId);
    }
    mapping.replaceFace(plan.faceId, replacement);
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "edge", elementIds: loopEdgeIds },
    warnings: [],
    newVertexIds,
    newFaceIds,
    loopEdgeIds,
  };
}

export function loopCutFactors(cuts: number, factor: number): number[] {
  const count = Math.max(1, Math.floor(cuts));
  const t = clampFactor(factor);
  if (count === 1) {
    return [t];
  }
  const values: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    values.push(clampFactor(i / (count + 1)));
  }
  return values;
}

export function factorOnOrientedEdge(
  mesh: HalfEdgeMesh,
  edge: OrientedLoopEdge,
  point: LoopCutVec3,
): number {
  const from = mesh.vertices.get(edge.from)?.position;
  const to = mesh.vertices.get(edge.to)?.position;
  if (!from || !to) {
    return 0.5;
  }
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const lengthSq = dx * dx + dy * dy + dz * dz;
  if (lengthSq < 1e-18) {
    return 0.5;
  }
  const t = ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy + (point[2] - from[2]) * dz) / lengthSq;
  return clampFactor(t);
}

function extendLoop(
  mesh: HalfEdgeMesh,
  start: OrientedLoopEdge,
  firstFace: FaceId,
  visited: Set<EdgeId>,
  out: OrientedLoopEdge[],
): void {
  let current = start;
  let faceId: FaceId | null = firstFace;
  let steps = 0;
  const limit = mesh.edges.size + 1;
  while (faceId) {
    steps += 1;
    if (steps > limit) {
      throw new RangeError("loopCut edge walk exceeded mesh size");
    }
    const next = oppositeOriented(mesh, faceId, current);
    if (!next || visited.has(next.edgeId)) {
      return;
    }
    visited.add(next.edgeId);
    out.push(next);
    const [fa, fb] = mesh.getEdgeFaces(next.edgeId);
    faceId = fa === faceId ? fb : fa;
    current = next;
  }
}

function oppositeOriented(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  current: OrientedLoopEdge,
): OrientedLoopEdge | null {
  const edges = mesh.getFaceEdges(faceId);
  if (edges.length !== 4) {
    return null;
  }
  const index = edges.indexOf(current.edgeId);
  if (index < 0) {
    return null;
  }
  const verts = mesh.getFaceVertices(faceId);
  const oppEdge = edges[(index + 2) % 4];
  if (!oppEdge) {
    return null;
  }
  const from = verts[index]!;
  const to = verts[(index + 1) % 4]!;
  const oppFrom = verts[(index + 2) % 4]!;
  const oppTo = verts[(index + 3) % 4]!;
  if (current.from === to && current.to === from) {
    return { edgeId: oppEdge, from: oppFrom, to: oppTo };
  }
  return { edgeId: oppEdge, from: oppTo, to: oppFrom };
}

function isClosedLoop(mesh: HalfEdgeMesh, oriented: readonly OrientedLoopEdge[]): boolean {
  if (oriented.length < 3) {
    return false;
  }
  const start = oriented[0]!;
  const [f1, f2] = mesh.getEdgeFaces(start.edgeId);
  if (!f1 || !f2) {
    return false;
  }
  const ids = new Set(oriented.map((edge) => edge.edgeId));
  const a = oppositeEdge(mesh, f1, start.edgeId);
  const b = oppositeEdge(mesh, f2, start.edgeId);
  return Boolean(a && b && ids.has(a) && ids.has(b));
}

function extendRing(
  mesh: HalfEdgeMesh,
  startEdgeId: EdgeId,
  faceId: FaceId | null,
  visited: Set<EdgeId>,
  ring: EdgeId[],
): void {
  let current = startEdgeId;
  let currentFace = faceId;
  let steps = 0;
  const limit = mesh.edges.size + 1;
  while (currentFace) {
    steps += 1;
    if (steps > limit) {
      throw new RangeError("edge ring walk exceeded mesh size");
    }
    const opposite = oppositeEdge(mesh, currentFace, current);
    if (!opposite) {
      return;
    }
    if (opposite === startEdgeId) {
      return;
    }
    if (visited.has(opposite)) {
      return;
    }
    visited.add(opposite);
    ring.push(opposite);
    const [fa, fb] = mesh.getEdgeFaces(opposite);
    currentFace = fa === currentFace ? fb : fa;
    current = opposite;
  }
}

function oppositeEdge(mesh: HalfEdgeMesh, faceId: FaceId, edgeId: EdgeId): EdgeId | null {
  const edges = mesh.getFaceEdges(faceId);
  if (edges.length !== 4) {
    return null;
  }
  const index = edges.indexOf(edgeId);
  if (index < 0) {
    return null;
  }
  return edges[(index + 2) % 4] ?? null;
}

function interpolateEdge(mesh: HalfEdgeMesh, edge: OrientedLoopEdge, t: number): LoopCutVec3 {
  const a = mesh.vertices.get(edge.from)!.position;
  const b = mesh.vertices.get(edge.to)!.position;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function expandFaceForLoopCut(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  splits: ReadonlyMap<EdgeId, VertexId[]>,
  orientation: ReadonlyMap<EdgeId, OrientedLoopEdge>,
): VertexId[] | null {
  const edges = mesh.getFaceEdges(faceId);
  if (!edges.some((id) => splits.has(id))) {
    return null;
  }
  const loop = mesh.getFaceVertices(faceId);
  const expanded: VertexId[] = [];
  for (let i = 0; i < loop.length; i += 1) {
    expanded.push(loop[i]!);
    const edgeId = edges[i];
    const inserted = edgeId ? splits.get(edgeId) : undefined;
    const oriented = edgeId ? orientation.get(edgeId) : undefined;
    if (!inserted || !oriented || !edgeId) {
      continue;
    }
    if (loop[i] === oriented.from) {
      expanded.push(...inserted);
    } else {
      expanded.push(...inserted.slice().reverse());
    }
  }
  if (expanded.length !== loop.length + insertedCount(splits, edges)) {
    return null;
  }
  return expanded;
}

function insertedCount(splits: ReadonlyMap<EdgeId, VertexId[]>, edges: readonly EdgeId[]): number {
  let count = 0;
  for (const edgeId of edges) {
    count += splits.get(edgeId)?.length ?? 0;
  }
  return count;
}

function stripQuads(expanded: readonly VertexId[], cuts: number): VertexId[][] {
  if (expanded.length !== 4 + cuts * 2) {
    return [];
  }
  const a = expanded[0]!;
  const b = expanded[cuts + 1]!;
  const c = expanded[cuts + 2]!;
  const d = expanded[expanded.length - 1]!;
  const midsStart = expanded.slice(1, cuts + 1);
  const midsEnd = expanded.slice(cuts + 3, cuts + 3 + cuts);
  const quads: VertexId[][] = [];
  quads.push([a, midsStart[0]!, midsEnd[cuts - 1]!, d]);
  for (let i = 1; i < cuts; i += 1) {
    quads.push([midsStart[i - 1]!, midsStart[i]!, midsEnd[i - 1]!, midsEnd[i]!]);
  }
  quads.push([midsStart[cuts - 1]!, b, c, midsEnd[0]!]);
  return quads;
}

function clampFactor(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(0.98, Math.max(0.02, value));
}
