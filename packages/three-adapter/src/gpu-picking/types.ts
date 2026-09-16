import type { FaceId, MeshId, ObjectId } from "@modeling-kit/core";
import type { PickBackfaceMode } from "@modeling-kit/selection";
import type { BufferGeometry, Matrix4, Object3D } from "three";
import type { RenderMapping } from "../geometry";
import type { GpuPickDomain } from "./registry";

export type PickingInvalidation =
  | "scene"
  | "geometry"
  | "transform"
  | "visibility"
  | "camera"
  | "resize"
  | "dispose"
  | "material"
  | "instance";

export type GpuPickingBackend = "gpu-id-buffer" | "software-id-buffer" | "unavailable";

export interface GpuPickDrawable {
  readonly objectId: ObjectId;
  readonly meshId?: MeshId;
  readonly visible: boolean;
  readonly selectable: boolean;
  readonly object: Object3D;
  readonly geometry: BufferGeometry;
  readonly mapping: RenderMapping;
  readonly matrixWorld: Matrix4;
  readonly geometryRevision: number;
}

export interface GpuPickRequest {
  readonly pixelX: number;
  readonly pixelY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly domain: GpuPickDomain;
  readonly backfaceMode: PickBackfaceMode;
}

export interface GpuPointPickResult {
  readonly objectId: ObjectId;
  readonly meshId?: MeshId;
  readonly faceId?: FaceId;
  readonly triangleIndex?: number;
  readonly depth?: number;
  readonly screenDistance: number;
  readonly source: "gpu-id-buffer";
}

export interface GpuPickingDiagnostics {
  readonly backend: GpuPickingBackend;
  readonly lastBackend: GpuPickingBackend;
  readonly registrySize: number;
  readonly lastInvalidation: PickingInvalidation | null;
  readonly disposed: boolean;
  readonly pendingRequests: number;
  readonly geometryBuilds: number;
  readonly pickRenders: number;
  readonly idOverflow: boolean;
  readonly uniqueFaceIds: number;
  readonly triangleSlots: number;
  readonly hasReadback: boolean;
  readonly contextLost: boolean;
  readonly lastReadError?: string;
}

export interface GpuPickingService {
  pick(request: GpuPickRequest): Promise<GpuPointPickResult | undefined>;
  invalidate(reason: PickingInvalidation): void;
  resize(width: number, height: number): void;
  dispose(): void;
  diagnostics(): GpuPickingDiagnostics;
}
