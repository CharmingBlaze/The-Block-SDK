import type { MeshId } from "@modeling-kit/core";

export const enum MeshVisualDirtyFlag {
  None = 0,
  Topology = 1 << 0,
  Positions = 1 << 1,
  Normals = 1 << 2,
  UVs = 1 << 3,
  Materials = 1 << 4,
  VertexStates = 1 << 5,
  EdgeStates = 1 << 6,
  FaceStates = 1 << 7,
  Bounds = 1 << 8,
  Picking = 1 << 9,
  BVH = 1 << 10,
  Theme = 1 << 11,
  Visibility = 1 << 12,
}

export interface MeshRevisions {
  topology: number;
  positions: number;
  attributes: number;
  uv: number;
  materials: number;
  visibility: number;
  selection: number;
  visualTheme: number;
}

export function emptyMeshRevisions(): MeshRevisions {
  return {
    topology: 0,
    positions: 0,
    attributes: 0,
    uv: 0,
    materials: 0,
    visibility: 0,
    selection: 0,
    visualTheme: 0,
  };
}

export interface MeshVisualSchedulerHandler {
  flushMesh(meshId: MeshId, flags: MeshVisualDirtyFlag): void;
}

export class MeshVisualScheduler {
  flushCount = 0;
  lastFlushFrame = -1;
  private readonly pending = new Map<string, MeshVisualDirtyFlag>();
  private readonly suspended = new Set<string>();
  private flushing = false;
  private disposed = false;
  private retries = 0;

  constructor(private readonly handler: MeshVisualSchedulerHandler) {}

  get isFlushing(): boolean {
    return this.flushing;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  get pendingFlags(): MeshVisualDirtyFlag {
    let flags = MeshVisualDirtyFlag.None;
    for (const value of this.pending.values()) {
      flags |= value;
    }
    return flags;
  }

  invalidate(meshId: MeshId | string, flags: MeshVisualDirtyFlag): void {
    if (this.disposed || flags === MeshVisualDirtyFlag.None) {
      return;
    }
    const key = String(meshId);
    if (this.suspended.has(key)) {
      this.pending.set(key, (this.pending.get(key) ?? MeshVisualDirtyFlag.None) | flags);
      return;
    }
    this.pending.set(key, (this.pending.get(key) ?? MeshVisualDirtyFlag.None) | flags);
  }

  suspend(meshId: MeshId | string): void {
    this.suspended.add(String(meshId));
  }

  resume(meshId: MeshId | string): void {
    this.suspended.delete(String(meshId));
  }

  flush(frameId: number): void {
    if (this.disposed) {
      return;
    }
    if (this.flushing) {
      return;
    }
    if (frameId === this.lastFlushFrame) {
      return;
    }
    this.flushing = true;
    this.retries = 0;
    try {
      this.lastFlushFrame = frameId;
      this.drain(frameId);
      this.flushCount += 1;
    } finally {
      this.flushing = false;
    }
  }

  /** Event-path flush: coalesces nested invalidation without a frame id. */
  flushNow(): void {
    if (this.disposed || this.flushing) {
      return;
    }
    this.flushing = true;
    this.retries = 0;
    try {
      this.drain(-1);
      this.flushCount += 1;
    } finally {
      this.flushing = false;
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pending.clear();
    this.suspended.clear();
  }

  private drain(frameId: number): void {
    while (this.pending.size > 0 && this.retries < 4) {
      this.retries += 1;
      const batch = new Map(this.pending);
      this.pending.clear();
      for (const [key, flags] of batch) {
        if (this.suspended.has(key)) {
          this.pending.set(key, (this.pending.get(key) ?? MeshVisualDirtyFlag.None) | flags);
          continue;
        }
        this.handler.flushMesh(key as MeshId, flags);
      }
      if (frameId >= 0 && this.retries > 1) {
        break;
      }
    }
  }
}
