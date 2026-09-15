export const enum UVPaintDirtyFlag {
  None = 0,
  UVTopology = 1 << 0,
  UVPositions = 1 << 1,
  UVSelection = 1 << 2,
  UVVisuals = 1 << 3,
  UVAnalysis = 1 << 4,
  ImageTiles = 1 << 5,
  ImageComposite = 1 << 6,
  RuntimeTexture = 1 << 7,
  MaterialBinding = 1 << 8,
  Picking = 1 << 9,
}

export interface UVPaintRevisions {
  meshTopology: number;
  meshPositions: number;
  uvCoordinates: number;
  uvSeams: number;
  uvPins: number;
  uvSelection: number;
  textureMetadata: number;
  imagePixels: number;
  layerStructure: number;
  layerProperties: number;
  materialBindings: number;
  visualTheme: number;
}

export function emptyUvPaintRevisions(): UVPaintRevisions {
  return {
    meshTopology: 0,
    meshPositions: 0,
    uvCoordinates: 0,
    uvSeams: 0,
    uvPins: 0,
    uvSelection: 0,
    textureMetadata: 0,
    imagePixels: 0,
    layerStructure: 0,
    layerProperties: 0,
    materialBindings: 0,
    visualTheme: 0,
  };
}

export class UVDirtyBatcher {
  pendingFlags = UVPaintDirtyFlag.None;
  private flushing = false;
  private disposed = false;
  flushCount = 0;
  scheduled = false;
  private static readonly MAX_FLUSH_PASSES = 8;

  mark(flags: UVPaintDirtyFlag): void {
    if (this.disposed || flags === UVPaintDirtyFlag.None) {
      return;
    }
    this.pendingFlags |= flags;
  }

  flush(handler: (flags: UVPaintDirtyFlag) => void): void {
    if (this.disposed || this.flushing || this.pendingFlags === UVPaintDirtyFlag.None) {
      return;
    }
    this.flushLoop(handler, 0);
  }

  private flushLoop(handler: (flags: UVPaintDirtyFlag) => void, depth: number): void {
    if (this.disposed || this.pendingFlags === UVPaintDirtyFlag.None) {
      return;
    }
    this.flushing = true;
    let succeeded = false;
    try {
      const flags = this.pendingFlags;
      this.pendingFlags = UVPaintDirtyFlag.None;
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
      this.scheduled = false;
    }
    if (
      succeeded &&
      !this.disposed &&
      this.pendingFlags !== UVPaintDirtyFlag.None &&
      depth + 1 < UVDirtyBatcher.MAX_FLUSH_PASSES
    ) {
      this.flushLoop(handler, depth + 1);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.pendingFlags = UVPaintDirtyFlag.None;
    this.scheduled = false;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
