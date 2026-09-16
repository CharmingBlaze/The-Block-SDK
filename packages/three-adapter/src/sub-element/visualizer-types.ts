import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type {
  BufferGeometry,
  Camera,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  Object3D,
  Points,
} from "three";
import type { RenderMapping } from "../geometry";
import type { IdIndexMap } from "./id-index";
import type { CompactElementStates } from "./element-flags";
import type { GpuResourceTracker } from "./resources";

export interface OverlayMeshSource {
  readonly objectId: ObjectId;
  readonly object: Object3D;
  readonly kernel: HalfEdgeMesh;
  readonly geometry: BufferGeometry;
  readonly mapping: RenderMapping;
}

export type OverlaySelectionDomain =
  | "none"
  | "object"
  | "vertex"
  | "edge"
  | "face"
  | "uv"
  | "bone"
  | "keyframe";

export interface VisualizerView {
  readonly camera: Camera;
  readonly width: number;
  readonly height: number;
}

export interface ObjectLayer {
  readonly group: Group;
  readonly vertices: IdIndexMap<VertexId>;
  readonly edges: IdIndexMap<EdgeId>;
  readonly faces: IdIndexMap<FaceId>;
  readonly resources: GpuResourceTracker;
  meshRevision: number;
  vertexMesh?: InstancedMesh | Points;
  vertexPick?: InstancedMesh;
  edgeLines?: LineSegments;
  edgeThick?: InstancedMesh;
  faceFill?: Mesh;
  faceOutline?: LineSegments;
  vertexPositions: Float32Array;
  edgeEndpoints: Float32Array;
  lastViewHash: number;
  presentationKey: string;
  readonly vertexStates: CompactElementStates;
  readonly edgeStates: CompactElementStates;
  readonly faceStates: CompactElementStates;
}

export interface OverlaySelection {
  domain: OverlaySelectionDomain;
  objectIds: readonly ObjectId[];
  elementIds: readonly string[];
  activeId: string | null;
}
