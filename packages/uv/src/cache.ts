import type { MeshId, UVChannelId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "./channels";
import { analyzeUvMesh, type UvAnalysis } from "./analyze";
import type { ConnectedUvIsland } from "./islands";
import {
  buildUvTopology,
  refreshUvTopologyPositions,
  topologyConnectivityMatches,
  type UVTopology,
} from "./topology";

export interface UVCacheKey {
  meshId: MeshId;
  topologyRevision: number;
  uvRevision: number;
  seamRevision: number;
  pinRevision: number;
  channelId: UVChannelId;
}

export interface DerivedUvVertex {
  readonly id: string;
  readonly u: number;
  readonly v: number;
  readonly cornerIds: readonly string[];
  readonly spatialVertexId: string;
}

export interface DerivedUvEdge {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly seam: boolean;
}

export interface DerivedUvFace {
  readonly faceId: string;
  readonly vertexIds: readonly string[];
}

export interface DerivedUvTopology {
  readonly key: UVCacheKey;
  readonly vertices: readonly DerivedUvVertex[];
  readonly edges: readonly DerivedUvEdge[];
  readonly faces: readonly DerivedUvFace[];
  readonly islands: readonly ConnectedUvIsland[];
  readonly analysis: UvAnalysis;
  readonly topology: UVTopology;
}

function cacheKeyString(key: UVCacheKey): string {
  return `${key.meshId}|${key.topologyRevision}|${key.uvRevision}|${key.seamRevision}|${key.pinRevision}|${key.channelId}`;
}

function connectivityKey(key: UVCacheKey): string {
  return `${key.meshId}|${key.topologyRevision}|${key.seamRevision}|${key.channelId}`;
}

function isSameMeshChannel(entryKey: string, meshId: MeshId, channelId: UVChannelId): boolean {
  return entryKey.startsWith(`${meshId}|`) && entryKey.endsWith(`|${channelId}`);
}

function isSameMeshChannelConnectivity(entryKey: string, meshId: MeshId, channelId: UVChannelId): boolean {
  return entryKey.startsWith(`${meshId}|`) && entryKey.endsWith(`|${channelId}`);
}

export class UvTopologyCache {
  connectivityBuilds = 0;
  private readonly entries = new Map<string, DerivedUvTopology>();
  private readonly connectivity = new Map<string, UVTopology>();
  private disposed = false;

  get size(): number {
    return this.entries.size;
  }

  get connectivitySize(): number {
    return this.connectivity.size;
  }

  get(key: UVCacheKey): DerivedUvTopology | undefined {
    return this.entries.get(cacheKeyString(key));
  }

  set(value: DerivedUvTopology): void {
    if (this.disposed) {
      return;
    }
    this.pruneStale(value.key);
    this.entries.set(cacheKeyString(value.key), value);
    this.connectivity.set(connectivityKey(value.key), value.topology);
  }

  private pruneStale(keep: UVCacheKey): void {
    const keepEntry = cacheKeyString(keep);
    const keepConn = connectivityKey(keep);
    for (const key of [...this.entries.keys()]) {
      if (key !== keepEntry && isSameMeshChannel(key, keep.meshId, keep.channelId)) {
        this.entries.delete(key);
      }
    }
    for (const key of [...this.connectivity.keys()]) {
      if (key !== keepConn && isSameMeshChannelConnectivity(key, keep.meshId, keep.channelId)) {
        this.connectivity.delete(key);
      }
    }
  }

  invalidateMesh(meshId: MeshId): void {
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(`${meshId}|`)) {
        this.entries.delete(key);
      }
    }
    for (const key of [...this.connectivity.keys()]) {
      if (key.startsWith(`${meshId}|`)) {
        this.connectivity.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.entries.clear();
    this.connectivity.clear();
  }

  getConnectivity(mesh: HalfEdgeMesh, channelId: UVChannelId): UVTopology | undefined {
    return this.connectivity.get(
      `${mesh.id}|${mesh.topologyRevision}|${mesh.seamRevision}|${channelId}`,
    );
  }
}

export function meshUvCacheKey(
  mesh: HalfEdgeMesh,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): UVCacheKey {
  return {
    meshId: mesh.id,
    topologyRevision: mesh.topologyRevision,
    uvRevision: mesh.uvRevision,
    seamRevision: mesh.seamRevision,
    pinRevision: mesh.pinRevision,
    channelId,
  };
}

export function getOrBuildUvTopology(
  mesh: HalfEdgeMesh,
  cache: UvTopologyCache,
  channelId: UVChannelId = DEFAULT_UV_CHANNEL,
): DerivedUvTopology {
  const key = meshUvCacheKey(mesh, channelId);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const prior = cache.getConnectivity(mesh, channelId);
  let topology: UVTopology;
  if (prior && topologyConnectivityMatches(mesh, prior)) {
    topology = refreshUvTopologyPositions(prior, mesh);
  } else {
    topology = buildUvTopology(mesh, channelId);
    cache.connectivityBuilds += 1;
  }
  const built = projectDerived(mesh, key, topology);
  cache.set(built);
  return built;
}

export function buildDerivedUvTopology(mesh: HalfEdgeMesh, key: UVCacheKey): DerivedUvTopology {
  return projectDerived(mesh, key, buildUvTopology(mesh, key.channelId));
}

function projectDerived(
  mesh: HalfEdgeMesh,
  key: UVCacheKey,
  topology: UVTopology,
): DerivedUvTopology {
  return {
    key,
    topology,
    vertices: [...topology.vertices.values()].map((vertex) => ({
      id: vertex.id,
      u: vertex.u,
      v: vertex.v,
      cornerIds: vertex.cornerIds,
      spatialVertexId: vertex.spatialVertexId,
    })),
    edges: [...topology.edges.values()].map((edge) => ({
      id: edge.id,
      a: edge.a,
      b: edge.b,
      seam: edge.seam,
    })),
    faces: [...topology.faces.values()].map((face) => ({
      faceId: face.faceId,
      vertexIds: face.vertexIds,
    })),
    islands: [...topology.islands.values()].map((island) => ({
      faceIds: [...island.faceIds],
      cornerIds: [...island.cornerIds],
    })),
    analysis: analyzeUvMesh(mesh),
  };
}
