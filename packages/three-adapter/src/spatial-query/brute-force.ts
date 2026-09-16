import type { SpatialHit, SpatialQueryBackend, SpatialRay } from "./types";

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
