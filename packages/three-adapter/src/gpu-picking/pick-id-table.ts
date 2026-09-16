import type { FaceId, ObjectId } from "@modeling-kit/core";
import { type PickIdCodec, rgb24PickIdCodec } from "./encode";
import type { GpuPickDrawable, GpuPointPickResult } from "./types";
import { InMemoryGpuPickRegistry, type GpuPickDomain } from "./registry";

export function facePickKey(objectId: ObjectId, faceId: FaceId): string {
  return `${objectId}:${faceId}`;
}

export class GpuPickIdTable {
  readonly registry: InMemoryGpuPickRegistry;
  private readonly objectPickIds = new Map<ObjectId, number>();
  private readonly facePickIds = new Map<string, number>();
  private readonly trianglePickIds = new Map<string, number>();
  private builtDomain: GpuPickDomain | undefined;
  dirty = true;
  builds = 0;
  overflowed = false;
  uniqueFaceIds = 0;
  triangleSlots = 0;

  constructor(codec: PickIdCodec = rgb24PickIdCodec) {
    this.registry = new InMemoryGpuPickRegistry(codec);
  }

  get size(): number {
    return this.registry.size;
  }

  rebuild(drawables: readonly GpuPickDrawable[], domain: GpuPickDomain): void {
    if (!this.dirty && this.builtDomain === domain && this.registry.size > 0 && !this.overflowed) {
      return;
    }
    this.reset();
    this.dirty = false;
    this.builtDomain = domain;
    this.builds += 1;

    for (const drawable of drawables) {
      if (!drawable.selectable) {
        continue;
      }
      if (domain === "object") {
        const pickId = this.registry.allocate({
          objectId: drawable.objectId,
          ...(drawable.meshId ? { meshId: drawable.meshId } : {}),
          domain: "object",
        });
        if (pickId === undefined) {
          this.markOverflow();
          return;
        }
        this.objectPickIds.set(drawable.objectId, pickId);
        continue;
      }
      this.triangleSlots += drawable.mapping.triangleToFace.length;
      for (let t = 0; t < drawable.mapping.triangleToFace.length; t += 1) {
        const faceId = drawable.mapping.triangleToFace[t];
        if (!faceId) {
          continue;
        }
        const key = facePickKey(drawable.objectId, faceId);
        let pickId = this.facePickIds.get(key);
        if (pickId === undefined) {
          pickId = this.registry.allocate({
            objectId: drawable.objectId,
            ...(drawable.meshId ? { meshId: drawable.meshId } : {}),
            domain: "face",
            faceId,
          });
          if (pickId === undefined) {
            this.markOverflow();
            return;
          }
          this.facePickIds.set(key, pickId);
          this.uniqueFaceIds += 1;
        }
        this.trianglePickIds.set(`${drawable.objectId}:${t}`, pickId);
      }
    }
  }

  lookup(objectId: ObjectId, domain: GpuPickDomain, triangleIndex: number): number | undefined {
    if (domain === "object") {
      return this.objectPickIds.get(objectId);
    }
    return this.trianglePickIds.get(`${objectId}:${triangleIndex}`);
  }

  resultFromPickId(pickId: number, depth?: number): GpuPointPickResult | undefined {
    const record = this.registry.resolve(pickId);
    if (!record) {
      return undefined;
    }
    return {
      objectId: record.objectId,
      ...(record.meshId ? { meshId: record.meshId } : {}),
      ...(record.faceId ? { faceId: record.faceId } : {}),
      ...(depth !== undefined ? { depth } : {}),
      screenDistance: 0,
      source: "gpu-id-buffer",
    };
  }

  clear(): void {
    this.reset();
    this.dirty = true;
    this.builtDomain = undefined;
  }

  private markOverflow(): void {
    this.reset();
    this.overflowed = true;
  }

  private reset(): void {
    this.registry.clear();
    this.objectPickIds.clear();
    this.facePickIds.clear();
    this.trianglePickIds.clear();
    this.overflowed = false;
    this.uniqueFaceIds = 0;
    this.triangleSlots = 0;
  }
}
