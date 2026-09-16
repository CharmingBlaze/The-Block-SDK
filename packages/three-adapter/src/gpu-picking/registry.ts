import type { FaceId, MeshId, ObjectId } from "@modeling-kit/core";
import { GPU_PICK_BACKGROUND_ID, type PickIdCodec, rgb24PickIdCodec } from "./encode";

export type GpuPickDomain = "object" | "face";

export interface GpuPickRecord {
  readonly objectId: ObjectId;
  readonly meshId?: MeshId;
  readonly domain: GpuPickDomain;
  readonly faceId?: FaceId;
  readonly triangleIndex?: number;
}

export interface GpuPickRegistry {
  allocate(record: GpuPickRecord): number | undefined;
  resolve(pickId: number): GpuPickRecord | undefined;
  clear(): void;
}

export class InMemoryGpuPickRegistry implements GpuPickRegistry {
  private readonly records: Array<GpuPickRecord | undefined> = [undefined];
  private generation = 0;
  private readonly codec: PickIdCodec;

  constructor(codec: PickIdCodec = rgb24PickIdCodec) {
    this.codec = codec;
  }

  get size(): number {
    return Math.max(0, this.records.length - 1);
  }

  get currentGeneration(): number {
    return this.generation;
  }

  get maxId(): number {
    return this.codec.maxId;
  }

  allocate(record: GpuPickRecord): number | undefined {
    if (this.records.length > this.codec.maxId) {
      return undefined;
    }
    this.records.push(record);
    return this.records.length - 1;
  }

  resolve(pickId: number): GpuPickRecord | undefined {
    if (!Number.isInteger(pickId) || pickId <= GPU_PICK_BACKGROUND_ID || pickId >= this.records.length) {
      return undefined;
    }
    return this.records[pickId];
  }

  invalidateObject(objectId: ObjectId): void {
    for (let i = 1; i < this.records.length; i += 1) {
      if (this.records[i]?.objectId === objectId) {
        this.records[i] = undefined;
      }
    }
  }

  invalidateFace(faceId: FaceId): void {
    for (let i = 1; i < this.records.length; i += 1) {
      if (this.records[i]?.faceId === faceId) {
        this.records[i] = undefined;
      }
    }
  }

  clear(): void {
    this.records.length = 1;
    this.generation += 1;
  }
}
