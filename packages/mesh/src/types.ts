import type {
  VertexId,
  EdgeId,
  HalfEdgeId,
  FaceId,
  CornerId,
  MeshId,
  MaterialSlotId,
  UVChannelId,
} from "@modeling-kit/core";

/** Finite Catmull–Clark edge sharpness in `[0, 1]`. */
export type EdgeCreaseWeight = number;

export interface VertexRecord {
  readonly id: VertexId;
  position: [x: number, y: number, z: number];
  halfEdge: HalfEdgeId | null;
}

export interface EdgeRecord {
  readonly id: EdgeId;
  halfEdge: HalfEdgeId;
  /** Default-channel seam flag kept for existing operators and serialization. */
  isSeam: boolean;
  /** Per-channel seam intent. Independent of mesh topology. */
  seamChannels?: readonly UVChannelId[] | undefined;
  /**
   * Shading/dihedral hint used by existing operators and the viewport.
   * Independent of Catmull–Clark `creaseWeight`.
   */
  creaseAngle?: number | undefined;
  /**
   * Normalized Catmull–Clark crease sharpness.
   * `0` = smooth, `1` = fully sharp for this simple model.
   * `undefined` is treated as `0`.
   */
  creaseWeight?: EdgeCreaseWeight | undefined;
}

export interface HalfEdgeRecord {
  readonly id: HalfEdgeId;
  readonly edgeId: EdgeId;
  origin: VertexId;
  twin: HalfEdgeId | null;
  next: HalfEdgeId;
  prev: HalfEdgeId;
  face: FaceId | null;
  corner: CornerId | null;
}

export interface CornerRecord {
  readonly id: CornerId;
  readonly vertexId: VertexId;
  readonly faceId: FaceId;
  uv?: [u: number, v: number] | undefined;
  uvChannels?: Readonly<Record<string, [u: number, v: number]>> | undefined;
  pinnedUvChannels?: readonly UVChannelId[] | undefined;
  normal?: [nx: number, ny: number, nz: number] | undefined;
  color?: [r: number, g: number, b: number, a: number] | undefined;
}

export interface MeshFace {
  readonly id: FaceId;
  readonly materialSlotId: MaterialSlotId | null;
}

export interface FaceRecord {
  readonly id: FaceId;
  halfEdge: HalfEdgeId;
  materialSlot: number;
  materialSlotId?: MaterialSlotId | null | undefined;
  isSmooth: boolean;
}

export interface MeshKernelData {
  readonly id: MeshId;
  readonly vertices: Map<VertexId, VertexRecord>;
  readonly edges: Map<EdgeId, EdgeRecord>;
  readonly halfEdges: Map<HalfEdgeId, HalfEdgeRecord>;
  readonly corners: Map<CornerId, CornerRecord>;
  readonly faces: Map<FaceId, FaceRecord>;
  revision: number;
}

export interface MeshComponent {
  readonly vertexIds: readonly VertexId[];
  readonly faceIds: readonly FaceId[];
}

export interface TriangulatedMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  /** Maps each rendered triangle index back to the canonical source FaceId */
  readonly triangleFaceIds: readonly FaceId[];
  /** Maps each render vertex index back to the canonical source VertexId */
  readonly vertexIdMap: readonly VertexId[];
  /** Maps each render vertex index back to the source corner that supplied UV/normal */
  readonly cornerIdMap: readonly CornerId[];
}
