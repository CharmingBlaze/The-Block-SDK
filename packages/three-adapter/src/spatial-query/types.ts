export interface SpatialRay {
  readonly origin: { x: number; y: number; z: number };
  readonly direction: { x: number; y: number; z: number };
}

export interface SpatialHit {
  readonly objectId: string;
  readonly distance: number;
  readonly point: { x: number; y: number; z: number };
}

export interface SpatialAabb {
  readonly objectId: string;
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
  /** Mesh or object revision. Unchanged fingerprints skip BVH rebuild. */
  readonly revision?: number;
  /** Topology-only clock. Materials and selection colors must not change this. */
  readonly topologyRevision?: number;
  /** Position-only clock. Used with topologyRevision for rebuild vs refit. */
  readonly positionsRevision?: number;
}

export type SpatialQueryPrimitive = SpatialAabb;

export interface SpatialQueryBackend {
  raycast(ray: SpatialRay): SpatialHit | null;
  /**
   * Replace indexed primitives. Revision-aware backends no-op when the
   * fingerprint is unchanged. Pointer moves must not call this.
   */
  syncPrimitives?(primitives: readonly SpatialAabb[]): void;
  dispose(): void;
}
