/**
 * Optional spatial acceleration for picking. Headless packages must not import three-mesh-bvh.
 */
export interface SpatialRay {
  readonly origin: { x: number; y: number; z: number };
  readonly direction: { x: number; y: number; z: number };
}

export interface SpatialHit {
  readonly objectId: string;
  readonly distance: number;
  readonly point: { x: number; y: number; z: number };
}

export interface SpatialQueryBackend {
  raycast(ray: SpatialRay): SpatialHit | null;
  dispose(): void;
}

export class BruteForceSpatialQuery implements SpatialQueryBackend {
  constructor(private readonly testers: readonly ((ray: SpatialRay) => SpatialHit | null)[] = []) {}

  raycast(ray: SpatialRay): SpatialHit | null {
    let best: SpatialHit | null = null;
    for (const test of this.testers) {
      const hit = test(ray);
      if (hit && (!best || hit.distance < best.distance)) {
        best = hit;
      }
    }
    return best;
  }

  dispose(): void {
    return;
  }
}
