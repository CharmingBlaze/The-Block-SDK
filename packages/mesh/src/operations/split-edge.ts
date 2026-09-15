import type { CornerId, EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import {
  interpolateSkinWeights,
  lerpColor,
  lerpUv,
  lerpVec3,
  type SkinInfluence,
} from "../internal/attribute-interpolation";
import { dropUnusedEdge, rebuildFaces, requireEdge, type FaceRebuildPlan } from "../internal/rebuild";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult } from "./contract";

export interface SplitEdgeRequest {
  readonly edgeId: EdgeId;
  readonly t: number;
  readonly skinWeights?: ReadonlyMap<VertexId, readonly SkinInfluence[]>;
}

export interface SplitEdgeResult extends MeshOperationResult {
  readonly newVertexId: VertexId;
  readonly firstEdgeId: EdgeId;
  readonly secondEdgeId: EdgeId;
  readonly interpolatedSkinWeights: readonly SkinInfluence[];
}

/**
 * Inserts a vertex on an edge at parameter t in (0, 1) along getEdgeVertices order.
 * Incident faces keep their ids. Per-corner UVs interpolate independently per face.
 */
export function splitEdge(
  mesh: HalfEdgeMesh,
  request: SplitEdgeRequest,
  ctx: MeshOperationContext,
): SplitEdgeResult {
  const { edgeId, t } = request;
  if (!Number.isFinite(t) || t <= 0 || t >= 1) {
    throw new RangeError("splitEdge t must be in (0, 1)");
  }
  const ends = mesh.getEdgeVertices(edgeId);
  if (!ends) {
    throw new RangeError(`Edge ${edgeId} does not exist`);
  }
  const [a, b] = ends;
  const pa = mesh.vertices.get(a)!;
  const pb = mesh.vertices.get(b)!;
  const mapping = new TopologyMappingBuilder(mesh);
  const previousCorners = new Map<FaceId, CornerId[]>();

  const vertexId = ctx.idFactory.vertex();
  const builder = MeshBuilder.fromMesh(mesh);
  builder.addVertex(
    pa.position[0] + (pb.position[0] - pa.position[0]) * t,
    pa.position[1] + (pb.position[1] - pa.position[1]) * t,
    pa.position[2] + (pb.position[2] - pa.position[2]) * t,
    vertexId,
  );
  mapping.createVertex(vertexId, [a, b]);

  const interpolatedSkinWeights = interpolateSkinWeights(
    request.skinWeights?.get(a) ?? [],
    request.skinWeights?.get(b) ?? [],
    t,
    ctx.attributes.normalizeWeights,
  );

  const sourceEdge = mesh.edges.get(edgeId)!;
  const [f1, f2] = mesh.getEdgeFaces(edgeId);
  const plans: FaceRebuildPlan[] = [];
  for (const faceId of [f1, f2]) {
    if (!faceId) {
      continue;
    }
    previousCorners.set(faceId, [...mesh.getFaceCorners(faceId)]);
    plans.push(expandFaceAcrossEdge(mesh, faceId, edgeId, a, b, vertexId, t, ctx));
  }
  if (plans.length === 0) {
    throw new RangeError(`Edge ${edgeId} has no incident faces`);
  }
  rebuildFaces(mesh, plans);
  dropUnusedEdge(mesh, edgeId);

  const e0 = requireEdge(mesh, a, vertexId);
  const e1 = requireEdge(mesh, vertexId, b);
  mapping.createEdge(e0, [edgeId]);
  mapping.createEdge(e1, [edgeId]);
  mapping.replaceEdge(edgeId, [e0, e1]);

  if (ctx.attributes.preserveSeams) {
    const first = mesh.edges.get(e0);
    const second = mesh.edges.get(e1);
    if (first) {
      first.isSeam = sourceEdge.isSeam;
    }
    if (second) {
      second.isSeam = sourceEdge.isSeam;
    }
  }
  if (ctx.attributes.preserveSharps) {
    const first = mesh.edges.get(e0);
    const second = mesh.edges.get(e1);
    if (first) {
      first.creaseAngle = sourceEdge.creaseAngle;
    }
    if (second) {
      second.creaseAngle = sourceEdge.creaseAngle;
    }
  }

  for (const [faceId, corners] of previousCorners) {
    mapping.recordFaceRebuild(mesh, faceId, corners);
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "vertex", elementIds: [vertexId] },
    warnings: [],
    newVertexId: vertexId,
    firstEdgeId: e0,
    secondEdgeId: e1,
    interpolatedSkinWeights,
  };
}

function expandFaceAcrossEdge(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  edgeId: EdgeId,
  a: VertexId,
  b: VertexId,
  inserted: VertexId,
  t: number,
  ctx: MeshOperationContext,
): FaceRebuildPlan {
  const loop = mesh.getFaceVertices(faceId);
  const faceEdges = mesh.getFaceEdges(faceId);
  const corners = mesh.getFaceCorners(faceId);
  const vertices: VertexId[] = [];
  const uvs: [number, number][] = [];
  const normals: [number, number, number][] = [];
  const colors: [number, number, number, number][] = [];
  let hasUv = false;
  let hasNormal = false;
  let hasColor = false;

  for (let i = 0; i < loop.length; i++) {
    const origin = loop[i]!;
    const corner = mesh.corners.get(corners[i]!);
    vertices.push(origin);
    if (corner?.uv) {
      hasUv = true;
      uvs.push([corner.uv[0], corner.uv[1]]);
    } else {
      uvs.push([0, 0]);
    }
    if (corner?.normal) {
      hasNormal = true;
      normals.push([corner.normal[0], corner.normal[1], corner.normal[2]]);
    } else {
      normals.push([0, 0, 1]);
    }
    if (corner?.color) {
      hasColor = true;
      colors.push([corner.color[0], corner.color[1], corner.color[2], corner.color[3]]);
    } else {
      colors.push([1, 1, 1, 1]);
    }
    if (faceEdges[i] !== edgeId) {
      continue;
    }
    vertices.push(inserted);
    const nextIndex = (i + 1) % loop.length;
    const alongFace = origin === a ? t : origin === b ? 1 - t : t;
    const nextCorner = mesh.corners.get(corners[nextIndex]!);
    if (ctx.attributes.interpolateUvs && corner?.uv && nextCorner?.uv) {
      uvs.push(lerpUv(corner.uv, nextCorner.uv, alongFace));
      hasUv = true;
    } else {
      uvs.push(uvs[uvs.length - 1] ?? [0, 0]);
    }
    if (corner?.normal && nextCorner?.normal) {
      normals.push(lerpVec3(corner.normal, nextCorner.normal, alongFace));
      hasNormal = true;
    } else {
      normals.push(normals[normals.length - 1] ?? [0, 0, 1]);
    }
    if (ctx.attributes.interpolateColors && corner?.color && nextCorner?.color) {
      colors.push(lerpColor(corner.color, nextCorner.color, alongFace));
      hasColor = true;
    } else {
      colors.push(colors[colors.length - 1] ?? [1, 1, 1, 1]);
    }
  }

  const face = mesh.faces.get(faceId)!;
  return {
    faceId,
    vertices,
    materialSlot: face.materialSlot,
    isSmooth: face.isSmooth,
    ...(hasUv ? { uvs } : {}),
    ...(hasNormal ? { normals } : {}),
    ...(hasColor ? { colors } : {}),
  };
}
