import {
  brand,
  type CornerId,
  type EdgeId,
  type FaceId,
  type MeshId,
  type UVChannelId,
  type UVEdgeId,
  type UVFaceId,
  type UVIslandId,
  type UVVertexId,
  type VertexId,
} from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "./channels";
import { getCornerUv, isCornerPinned } from "./corners";
import { edgeHasSeam } from "./seams";

export interface UVVertex {
  readonly id: UVVertexId;
  readonly u: number;
  readonly v: number;
  readonly cornerIds: readonly CornerId[];
  readonly spatialVertexId: VertexId;
  readonly pinned: boolean;
}

export interface UVEdge {
  readonly id: UVEdgeId;
  readonly a: UVVertexId;
  readonly b: UVVertexId;
  readonly meshEdgeId: EdgeId;
  readonly seam: boolean;
  readonly boundary: boolean;
}

export interface UVFace {
  readonly id: UVFaceId;
  readonly faceId: FaceId;
  readonly vertexIds: readonly UVVertexId[];
  readonly edgeIds: readonly UVEdgeId[];
  readonly islandId: UVIslandId;
  readonly materialSlot: number;
  readonly flipped: boolean;
}

export interface UVIsland {
  readonly id: UVIslandId;
  readonly faceIds: readonly FaceId[];
  readonly uvFaceIds: readonly UVFaceId[];
  readonly vertexIds: readonly UVVertexId[];
  readonly cornerIds: readonly CornerId[];
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

export interface UVTopology {
  readonly meshId: MeshId;
  readonly channelId: UVChannelId;
  readonly sourceTopologyRevision: number;
  readonly sourceUVRevision: number;
  readonly sourceSeamRevision: number;
  readonly vertices: ReadonlyMap<UVVertexId, UVVertex>;
  readonly edges: ReadonlyMap<UVEdgeId, UVEdge>;
  readonly faces: ReadonlyMap<UVFaceId, UVFace>;
  readonly islands: ReadonlyMap<UVIslandId, UVIsland>;
  readonly cornerToUVVertex: ReadonlyMap<CornerId, UVVertexId>;
  readonly faceToUVFace: ReadonlyMap<FaceId, UVFaceId>;
}

function stableJoin(parts: readonly string[]): string {
  return [...parts].sort().join("+");
}

function uvVertexId(cornerIds: readonly CornerId[]): UVVertexId {
  return brand(`uvv:${stableJoin(cornerIds)}`);
}

function uvEdgeId(a: UVVertexId, b: UVVertexId, meshEdgeId: EdgeId): UVEdgeId {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return brand(`uve:${meshEdgeId}:${lo}:${hi}`);
}

function uvFaceId(faceId: FaceId, channelId: UVChannelId): UVFaceId {
  return brand(`uvf:${channelId}:${faceId}`);
}

function uvIslandId(faceIds: readonly FaceId[]): UVIslandId {
  return brand(`uvi:${stableJoin(faceIds)}`);
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    let root = this.parent.get(id) ?? id;
    const path: string[] = [];
    while (root !== (this.parent.get(root) ?? root)) {
      path.push(root);
      root = this.parent.get(root) ?? root;
      if (path.length > this.parent.size + 8) {
        throw new RangeError("UV vertex union-find exceeded iteration limit");
      }
    }
    for (const node of path) {
      this.parent.set(node, root);
    }
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) {
      return;
    }
    if (ra < rb) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(ra, rb);
    }
  }
}

function signedUvArea(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  channelId: UVChannelId,
): number {
  const corners = mesh.getFaceCorners(faceId);
  let area = 0;
  const n = corners.length;
  for (let i = 0; i < n; i += 1) {
    const a = getCornerUv(mesh, corners[i]!, channelId);
    const b = getCornerUv(mesh, corners[(i + 1) % n]!, channelId);
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}

interface IslandBuckets {
  readonly faceIds: FaceId[];
  readonly cornerIds: CornerId[];
}

function floodIslands(mesh: HalfEdgeMesh, channelId: UVChannelId): IslandBuckets[] {
  const remaining = new Set(mesh.faces.keys());
  const islands: IslandBuckets[] = [];
  const maxFaces = mesh.faces.size * 4 + 8;
  let processed = 0;
  while (remaining.size > 0) {
    const start = remaining.values().next().value as FaceId;
    const faceIds: FaceId[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      processed += 1;
      if (processed > maxFaces) {
        throw new RangeError("UV island traversal exceeded maximum face count");
      }
      const faceId = queue.pop()!;
      faceIds.push(faceId);
      for (const edgeId of mesh.getFaceEdges(faceId)) {
        const edge = mesh.edges.get(edgeId);
        if (!edge || edgeHasSeam(edge, channelId)) {
          continue;
        }
        const [f1, f2] = mesh.getEdgeFaces(edgeId);
        const next = f1 === faceId ? f2 : f1;
        if (next && remaining.has(next)) {
          remaining.delete(next);
          queue.push(next);
        }
      }
    }
    islands.push({
      faceIds,
      cornerIds: faceIds.flatMap((id) => mesh.getFaceCorners(id)),
    });
  }
  return islands;
}

function weldCorners(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId,
): Map<CornerId, CornerId[]> {
  const uf = new UnionFind();
  for (const corner of mesh.corners.values()) {
    uf.find(corner.id);
  }
  for (const edge of mesh.edges.values()) {
    if (edgeHasSeam(edge, channelId)) {
      continue;
    }
    const [f1, f2] = mesh.getEdgeFaces(edge.id);
    if (!f1 || !f2) {
      continue;
    }
    const verts = mesh.getEdgeVertices(edge.id);
    if (!verts) {
      continue;
    }
    const cornersA = mesh.getFaceCorners(f1);
    const cornersB = mesh.getFaceCorners(f2);
    for (const vertexId of verts) {
      const ca = cornersA.find((id) => mesh.corners.get(id)?.vertexId === vertexId);
      const cb = cornersB.find((id) => mesh.corners.get(id)?.vertexId === vertexId);
      if (!ca || !cb) {
        continue;
      }
      const ua = getCornerUv(mesh, ca, channelId);
      const ub = getCornerUv(mesh, cb, channelId);
      if (Math.abs(ua[0] - ub[0]) > 1e-6 || Math.abs(ua[1] - ub[1]) > 1e-6) {
        continue;
      }
      uf.union(ca, cb);
    }
  }
  const groups = new Map<string, CornerId[]>();
  for (const corner of mesh.corners.values()) {
    const root = uf.find(corner.id);
    const list = groups.get(root) ?? [];
    list.push(corner.id);
    groups.set(root, list);
  }
  const byCorner = new Map<CornerId, CornerId[]>();
  for (const members of groups.values()) {
    const sorted = [...members].sort();
    for (const id of sorted) {
      byCorner.set(id, sorted);
    }
  }
  return byCorner;
}

export function buildUvTopology(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): UVTopology {
  const weld = weldCorners(mesh, channelId);
  const cornerToUVVertex = new Map<CornerId, UVVertexId>();
  const vertices = new Map<UVVertexId, UVVertex>();

  for (const [cornerId, members] of weld) {
    const id = uvVertexId(members);
    if (!vertices.has(id)) {
      const first = mesh.corners.get(members[0]!);
      const uv = getCornerUv(mesh, members[0]!, channelId);
      const pinned = members.some((member) => isCornerPinned(mesh, member, channelId));
      vertices.set(id, {
        id,
        u: uv[0],
        v: uv[1],
        cornerIds: members,
        spatialVertexId: first?.vertexId ?? brand("missing"),
        pinned,
      });
    }
    cornerToUVVertex.set(cornerId, id);
  }

  const islands = new Map<UVIslandId, UVIsland>();
  const faces = new Map<UVFaceId, UVFace>();
  const edges = new Map<UVEdgeId, UVEdge>();
  const faceToUVFace = new Map<FaceId, UVFaceId>();
  const buckets = floodIslands(mesh, channelId);

  for (const bucket of buckets) {
    const islandId = uvIslandId(bucket.faceIds);
    const uvFaceIds: UVFaceId[] = [];
    const vertexIds = new Set<UVVertexId>();
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;

    for (const faceId of bucket.faceIds) {
      const corners = mesh.getFaceCorners(faceId);
      const edgeIds = mesh.getFaceEdges(faceId);
      const vertexList: UVVertexId[] = [];
      const faceEdgeIds: UVEdgeId[] = [];
      const faceRecord = mesh.faces.get(faceId);
      for (let i = 0; i < corners.length; i += 1) {
        const cornerId = corners[i]!;
        const uvVertexId = cornerToUVVertex.get(cornerId);
        if (!uvVertexId) {
          continue;
        }
        vertexList.push(uvVertexId);
        vertexIds.add(uvVertexId);
        const vertex = vertices.get(uvVertexId);
        if (vertex) {
          minU = Math.min(minU, vertex.u);
          minV = Math.min(minV, vertex.v);
          maxU = Math.max(maxU, vertex.u);
          maxV = Math.max(maxV, vertex.v);
        }
        const nextCorner = corners[(i + 1) % corners.length]!;
        const nextUv = cornerToUVVertex.get(nextCorner);
        const meshEdgeId = edgeIds[i];
        if (!nextUv || !meshEdgeId) {
          continue;
        }
        const meshEdge = mesh.edges.get(meshEdgeId);
        const [f1, f2] = mesh.getEdgeFaces(meshEdgeId);
        const id = uvEdgeId(uvVertexId, nextUv, meshEdgeId);
        faceEdgeIds.push(id);
        if (!edges.has(id)) {
          edges.set(id, {
            id,
            a: uvVertexId,
            b: nextUv,
            meshEdgeId,
            seam: meshEdge ? edgeHasSeam(meshEdge, channelId) : false,
            boundary: !f1 || !f2,
          });
        }
      }
      const id = uvFaceId(faceId, channelId);
      uvFaceIds.push(id);
      faceToUVFace.set(faceId, id);
      faces.set(id, {
        id,
        faceId,
        vertexIds: vertexList,
        edgeIds: faceEdgeIds,
        islandId,
        materialSlot: faceRecord?.materialSlot ?? 0,
        flipped: signedUvArea(mesh, faceId, channelId) < 0,
      });
    }

    islands.set(islandId, {
      id: islandId,
      faceIds: bucket.faceIds,
      uvFaceIds,
      vertexIds: [...vertexIds],
      cornerIds: bucket.cornerIds,
      minU: Number.isFinite(minU) ? minU : 0,
      minV: Number.isFinite(minV) ? minV : 0,
      maxU: Number.isFinite(maxU) ? maxU : 0,
      maxV: Number.isFinite(maxV) ? maxV : 0,
    });
  }

  return {
    meshId: mesh.id,
    channelId,
    sourceTopologyRevision: mesh.topologyRevision,
    sourceUVRevision: mesh.uvRevision,
    sourceSeamRevision: mesh.seamRevision,
    vertices,
    edges,
    faces,
    islands,
    cornerToUVVertex,
    faceToUVFace,
  };
}

export function refreshUvTopologyPositions(
  previous: UVTopology,
  mesh: HalfEdgeMesh,
): UVTopology {
  const vertices = new Map<UVVertexId, UVVertex>();
  for (const vertex of previous.vertices.values()) {
    const uv = getCornerUv(mesh, vertex.cornerIds[0]!, previous.channelId);
    const pinned = vertex.cornerIds.some((id) => isCornerPinned(mesh, id, previous.channelId));
    vertices.set(vertex.id, { ...vertex, u: uv[0], v: uv[1], pinned });
  }
  const islands = new Map<UVIslandId, UVIsland>();
  for (const island of previous.islands.values()) {
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    for (const vertexId of island.vertexIds) {
      const vertex = vertices.get(vertexId);
      if (!vertex) {
        continue;
      }
      minU = Math.min(minU, vertex.u);
      minV = Math.min(minV, vertex.v);
      maxU = Math.max(maxU, vertex.u);
      maxV = Math.max(maxV, vertex.v);
    }
    islands.set(island.id, {
      ...island,
      minU: Number.isFinite(minU) ? minU : island.minU,
      minV: Number.isFinite(minV) ? minV : island.minV,
      maxU: Number.isFinite(maxU) ? maxU : island.maxU,
      maxV: Number.isFinite(maxV) ? maxV : island.maxV,
    });
  }
  const faces = new Map<UVFaceId, UVFace>();
  for (const face of previous.faces.values()) {
    faces.set(face.id, {
      ...face,
      flipped: signedUvArea(mesh, face.faceId, previous.channelId) < 0,
    });
  }
  return {
    ...previous,
    sourceUVRevision: mesh.uvRevision,
    vertices,
    faces,
    islands,
  };
}

export function topologyConnectivityMatches(mesh: HalfEdgeMesh, topology: UVTopology): boolean {
  return (
    mesh.id === topology.meshId &&
    mesh.topologyRevision === topology.sourceTopologyRevision &&
    mesh.seamRevision === topology.sourceSeamRevision
  );
}
