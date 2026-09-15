import type { CornerId, EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { deleteFace } from "../internal/delete-face";
import { repairVertexHalfEdges, requireEdge } from "../internal/rebuild";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";
import { runTransactionalMeshOp } from "./contract";
import { splitEdge } from "./split-edge";

export type CutEndpoint =
  | { readonly kind: "vertex"; readonly vertexId: VertexId }
  | { readonly kind: "edge"; readonly edgeId: EdgeId; readonly t: number };

export interface CutFaceRequest {
  readonly faceId: FaceId;
  readonly from: CutEndpoint;
  readonly to: CutEndpoint;
}

export interface CutFaceResult extends MeshOperationResult {
  readonly fromVertexId: VertexId;
  readonly toVertexId: VertexId;
  readonly preservedFaceId: FaceId;
  readonly newFaceId: FaceId;
  readonly newEdgeId: EdgeId;
}

export function cutFace(
  mesh: HalfEdgeMesh,
  request: CutFaceRequest,
  ctx: MeshOperationContext,
): CutFaceResult {
  return runTransactionalMeshOp(mesh, () => cutFaceUnlocked(mesh, request, ctx));
}

function cutFaceUnlocked(
  mesh: HalfEdgeMesh,
  request: CutFaceRequest,
  ctx: MeshOperationContext,
): CutFaceResult {
  const { faceId } = request;
  if (!mesh.faces.has(faceId)) {
    throw new RangeError(`Face ${faceId} does not exist`);
  }
  if (sameEndpoint(request.from, request.to)) {
    throw new RangeError("cutFace requires two distinct endpoints");
  }
  validateEndpoint(mesh, faceId, request.from);
  validateEndpoint(mesh, faceId, request.to);
  if (request.from.kind === "edge" && request.to.kind === "edge" && request.from.edgeId === request.to.edgeId) {
    throw new RangeError("cutFace cannot use two parameters on the same edge");
  }

  const mapping = new TopologyMappingBuilder(mesh);
  const fromVertexId = resolveEndpoint(mesh, faceId, request.from, ctx, mapping);
  const toVertexId = resolveEndpoint(mesh, faceId, request.to, ctx, mapping);
  if (fromVertexId === toVertexId) {
    throw new RangeError("cutFace endpoints resolved to the same vertex");
  }

  const face = mesh.faces.get(faceId);
  if (!face) {
    throw new RangeError(`Face ${faceId} was removed while resolving endpoints`);
  }
  const loop = mesh.getFaceVertices(faceId);
  const corners = mesh.getFaceCorners(faceId);
  const i = loop.indexOf(fromVertexId);
  const j = loop.indexOf(toVertexId);
  if (i < 0 || j < 0) {
    throw new RangeError("cutFace endpoints must lie on the face boundary");
  }
  const n = loop.length;
  const gap = Math.abs(i - j);
  if (gap === 1 || gap === n - 1) {
    throw new RangeError("cutFace cannot cut along an existing edge");
  }

  const pathA = walkLoop(loop, i, j);
  const pathB = walkLoop(loop, j, i);
  if (pathA.length < 3 || pathB.length < 3) {
    throw new RangeError("cutFace produced a degenerate polygon");
  }

  const attrs = faceLoopAttributes(mesh, faceId);
  const attrsA = walkAttrs(loop, attrs, i, j);
  const attrsB = walkAttrs(loop, attrs, j, i);
  const preserveA = shouldPreserveOriginalFace(corners, loop, pathA, pathB);
  const otherFaceId = ctx.idFactory.face();
  const preservedFaceId = faceId;
  const newFaceId = otherFaceId;
  const firstPlan = preserveA
    ? { id: preservedFaceId, path: pathA, attrs: attrsA }
    : { id: preservedFaceId, path: pathB, attrs: attrsB };
  const secondPlan = preserveA
    ? { id: newFaceId, path: pathB, attrs: attrsB }
    : { id: newFaceId, path: pathA, attrs: attrsA };

  const previousCorners = [...corners];
  deleteFace(mesh, faceId);
  for (const cornerId of previousCorners) {
    mapping.deleteCorner(cornerId);
  }

  const builder = MeshBuilder.fromMesh(mesh);
  builder.addFace(firstPlan.path, {
    id: firstPlan.id,
    materialSlot: face.materialSlot,
    isSmooth: face.isSmooth,
    ...(attrs.hasUv ? { uvs: firstPlan.attrs.uvs } : {}),
    ...(attrs.hasNormal ? { normals: firstPlan.attrs.normals } : {}),
    ...(attrs.hasColor ? { colors: firstPlan.attrs.colors } : {}),
  });
  builder.addFace(secondPlan.path, {
    id: secondPlan.id,
    materialSlot: face.materialSlot,
    isSmooth: face.isSmooth,
    ...(attrs.hasUv ? { uvs: secondPlan.attrs.uvs } : {}),
    ...(attrs.hasNormal ? { normals: secondPlan.attrs.normals } : {}),
    ...(attrs.hasColor ? { colors: secondPlan.attrs.colors } : {}),
  });
  repairVertexHalfEdges(mesh);

  mapping.createFace(newFaceId, [faceId]);
  mapping.replaceFace(faceId, [preservedFaceId, newFaceId]);
  for (const cornerId of mesh.getFaceCorners(firstPlan.id)) {
    mapping.createCorner(cornerId, previousCorners);
  }
  for (const cornerId of mesh.getFaceCorners(secondPlan.id)) {
    mapping.createCorner(cornerId, previousCorners);
  }

  const newEdgeId = requireEdge(mesh, fromVertexId, toVertexId);
  mapping.createEdge(newEdgeId, []);

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "edge", elementIds: [newEdgeId] },
    warnings: [],
    fromVertexId,
    toVertexId,
    preservedFaceId,
    newFaceId,
    newEdgeId,
  };
}

function validateEndpoint(mesh: HalfEdgeMesh, faceId: FaceId, endpoint: CutEndpoint): void {
  if (endpoint.kind === "vertex") {
    if (!mesh.vertices.has(endpoint.vertexId)) {
      throw new RangeError(`Vertex ${endpoint.vertexId} does not exist`);
    }
    if (!mesh.getFaceVertices(faceId).includes(endpoint.vertexId)) {
      throw new RangeError("cutFace vertex endpoints must lie on the face");
    }
    return;
  }
  if (!Number.isFinite(endpoint.t) || endpoint.t <= 0 || endpoint.t >= 1) {
    throw new RangeError("cutFace edge parameter t must be in (0, 1)");
  }
  if (!mesh.getFaceEdges(faceId).includes(endpoint.edgeId)) {
    throw new RangeError(`Edge ${endpoint.edgeId} is not on face ${faceId}`);
  }
}

function resolveEndpoint(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  endpoint: CutEndpoint,
  ctx: MeshOperationContext,
  mapping: TopologyMappingBuilder,
): VertexId {
  if (endpoint.kind === "vertex") {
    return endpoint.vertexId;
  }
  const split = splitEdge(mesh, { edgeId: endpoint.edgeId, t: endpoint.t }, ctx);
  mergeSplitMapping(mapping, split);
  return split.newVertexId;
}

function mergeSplitMapping(target: TopologyMappingBuilder, split: ReturnType<typeof splitEdge>): void {
  for (const id of split.mapping.vertices.created) {
    target.createVertex(id, split.mapping.vertices.derivedFrom.get(id));
  }
  for (const [oldId, news] of split.mapping.edges.replacedBy) {
    for (const next of news) {
      target.createEdge(next, [oldId]);
    }
    target.replaceEdge(oldId, news);
  }
  for (const id of split.mapping.corners.deleted) {
    target.deleteCorner(id);
  }
  for (const id of split.mapping.corners.created) {
    target.createCorner(id, split.mapping.corners.derivedFrom.get(id));
  }
}

function sameEndpoint(a: CutEndpoint, b: CutEndpoint): boolean {
  if (a.kind === "vertex" && b.kind === "vertex") {
    return a.vertexId === b.vertexId;
  }
  if (a.kind === "edge" && b.kind === "edge") {
    return a.edgeId === b.edgeId && a.t === b.t;
  }
  return false;
}

function shouldPreserveOriginalFace(
  corners: readonly CornerId[],
  loop: readonly VertexId[],
  pathA: readonly VertexId[],
  pathB: readonly VertexId[],
): boolean {
  let lowest = corners[0]!;
  for (const id of corners) {
    if (id < lowest) {
      lowest = id;
    }
  }
  const index = corners.indexOf(lowest);
  const vertex = loop[index]!;
  const exclusiveA = pathA.includes(vertex) && !isSharedEndpoint(vertex, pathA, pathB);
  const exclusiveB = pathB.includes(vertex) && !isSharedEndpoint(vertex, pathA, pathB);
  if (exclusiveA) {
    return true;
  }
  if (exclusiveB) {
    return false;
  }
  const next = loop[(index + 1) % loop.length]!;
  return pathA.includes(next) && next !== pathA[pathA.length - 1];
}

function isSharedEndpoint(
  vertex: VertexId,
  pathA: readonly VertexId[],
  pathB: readonly VertexId[],
): boolean {
  const a0 = pathA[0];
  const aN = pathA[pathA.length - 1];
  return (vertex === a0 || vertex === aN) && pathB[0] === aN && pathB[pathB.length - 1] === a0;
}

function walkLoop(loop: readonly VertexId[], start: number, end: number): VertexId[] {
  const out: VertexId[] = [loop[start]!];
  let k = start;
  let steps = 0;
  const limit = loop.length + 1;
  while (k !== end) {
    steps += 1;
    if (steps > limit) {
      throw new RangeError("cutFace loop walk exceeded face degree");
    }
    k = (k + 1) % loop.length;
    out.push(loop[k]!);
  }
  return out;
}

interface LoopAttrs {
  hasUv: boolean;
  hasNormal: boolean;
  hasColor: boolean;
  uvs: [number, number][];
  normals: [number, number, number][];
  colors: [number, number, number, number][];
}

function faceLoopAttributes(mesh: HalfEdgeMesh, faceId: FaceId): LoopAttrs {
  const corners = mesh.getFaceCorners(faceId);
  const attrs: LoopAttrs = {
    hasUv: false,
    hasNormal: false,
    hasColor: false,
    uvs: [],
    normals: [],
    colors: [],
  };
  for (const cornerId of corners) {
    const corner = mesh.corners.get(cornerId);
    if (corner?.uv) {
      attrs.hasUv = true;
      attrs.uvs.push([corner.uv[0], corner.uv[1]]);
    } else {
      attrs.uvs.push([0, 0]);
    }
    if (corner?.normal) {
      attrs.hasNormal = true;
      attrs.normals.push([corner.normal[0], corner.normal[1], corner.normal[2]]);
    } else {
      attrs.normals.push([0, 0, 1]);
    }
    if (corner?.color) {
      attrs.hasColor = true;
      attrs.colors.push([corner.color[0], corner.color[1], corner.color[2], corner.color[3]]);
    } else {
      attrs.colors.push([1, 1, 1, 1]);
    }
  }
  return attrs;
}

function walkAttrs(loop: readonly VertexId[], attrs: LoopAttrs, start: number, end: number): LoopAttrs {
  const out: LoopAttrs = {
    hasUv: attrs.hasUv,
    hasNormal: attrs.hasNormal,
    hasColor: attrs.hasColor,
    uvs: [attrs.uvs[start]!],
    normals: [attrs.normals[start]!],
    colors: [attrs.colors[start]!],
  };
  let k = start;
  let steps = 0;
  const limit = loop.length + 1;
  while (k !== end) {
    steps += 1;
    if (steps > limit) {
      throw new RangeError("cutFace attribute walk exceeded face degree");
    }
    k = (k + 1) % loop.length;
    out.uvs.push(attrs.uvs[k]!);
    out.normals.push(attrs.normals[k]!);
    out.colors.push(attrs.colors[k]!);
  }
  return out;
}
