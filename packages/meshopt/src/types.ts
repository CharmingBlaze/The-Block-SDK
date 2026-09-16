import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";

export type MeshoptMode = "reorder" | "simplify";

export type MappingStatus = "exact" | "partial" | "none";

export interface DerivedTriangleBuffers {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array;
  readonly uvs?: Float32Array;
  readonly triangleFaceIds?: readonly FaceId[];
  readonly vertexIdMap?: readonly VertexId[];
  readonly cornerIdMap?: readonly CornerId[];
}

export interface MeshoptRequest extends DerivedTriangleBuffers {
  readonly revision: number;
  readonly mode: MeshoptMode;
  /** When true, reorder for transmission size; otherwise GPU cache/fetch locality. */
  readonly optsize?: boolean;
  readonly targetIndexCount?: number;
  readonly targetIndexRatio?: number;
  readonly targetError?: number;
  /** Extra LOD ratios relative to the source index count, exclusive of the primary target. */
  readonly lodRatios?: readonly number[];
}

export interface TriangleMapping {
  readonly status: MappingStatus;
  readonly triangleFaceIds?: readonly FaceId[];
  readonly vertexIdMap?: readonly VertexId[];
  readonly cornerIdMap?: readonly CornerId[];
  readonly limitation?: string;
}

export interface OptimizedTriangles {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array;
  readonly uvs?: Float32Array;
  readonly mapping: TriangleMapping;
  readonly error?: number;
}

export interface MeshoptLodLevel extends OptimizedTriangles {
  readonly indexCount: number;
  readonly ratio: number;
}

export interface MeshoptSuccess {
  readonly ok: true;
  readonly revision: number;
  readonly primary: OptimizedTriangles;
  readonly lod: readonly MeshoptLodLevel[];
}

export interface MeshoptFailure {
  readonly ok: false;
  readonly error: string;
  readonly code:
    | "cancelled"
    | "stale-revision"
    | "invalid-input"
    | "limit-exceeded"
    | "timeout"
    | "backend-failed"
    | "disposed";
}

export type MeshoptJobResult = MeshoptSuccess | MeshoptFailure;

export type MeshoptJobState =
  | "queued"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "disposed";
