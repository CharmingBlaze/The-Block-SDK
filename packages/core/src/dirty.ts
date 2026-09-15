export const enum SDKDirtyFlag {
  None = 0,
  Hierarchy = 1 << 0,
  Transforms = 1 << 1,
  Topology = 1 << 2,
  Positions = 1 << 3,
  Normals = 1 << 4,
  UVs = 1 << 5,
  Seams = 1 << 6,
  Materials = 1 << 7,
  TextureBindings = 1 << 8,
  TexturePixels = 1 << 9,
  LayerStructure = 1 << 10,
  LayerProperties = 1 << 11,
  Selection = 1 << 12,
  Picking = 1 << 13,
}

export class DirtyBatcher {
  pendingFlags = SDKDirtyFlag.None;
  private flushing = false;
  private disposed = false;
  flushCount = 0;

  mark(flags: SDKDirtyFlag): void {
    if (this.disposed || flags === SDKDirtyFlag.None) {
      return;
    }
    this.pendingFlags |= flags;
  }

  flush(handler: (flags: SDKDirtyFlag) => void): void {
    if (this.disposed) {
      return;
    }
    if (this.flushing) {
      return;
    }
    this.flushLoop(handler, 0);
  }

  private static readonly MAX_FLUSH_PASSES = 8;

  private flushLoop(handler: (flags: SDKDirtyFlag) => void, depth: number): void {
    if (this.disposed || this.pendingFlags === SDKDirtyFlag.None) {
      return;
    }
    this.flushing = true;
    let succeeded = false;
    try {
      const flags = this.pendingFlags;
      this.pendingFlags = SDKDirtyFlag.None;
      try {
        handler(flags);
        succeeded = true;
        this.flushCount += 1;
      } catch (error) {
        this.pendingFlags |= flags;
        throw error;
      }
    } finally {
      this.flushing = false;
    }
    if (
      succeeded &&
      !this.disposed &&
      this.pendingFlags !== SDKDirtyFlag.None &&
      depth + 1 < DirtyBatcher.MAX_FLUSH_PASSES
    ) {
      this.flushLoop(handler, depth + 1);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.pendingFlags = SDKDirtyFlag.None;
  }
}
