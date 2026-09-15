export interface SDKResourceDiagnostics {
  subscriptions: number;
  runtimeMaterials: number;
  runtimeTextures: number;
  runtimeGeometries: number;
  objectUrls: number;
  workers: number;
  scheduledJobs: number;
  activePaintStrokes: number;
  activeTransactions: number;
  cachedUVTopologies: number;
  cachedImageComposites: number;
}

export function emptyResourceDiagnostics(): SDKResourceDiagnostics {
  return {
    subscriptions: 0,
    runtimeMaterials: 0,
    runtimeTextures: 0,
    runtimeGeometries: 0,
    objectUrls: 0,
    workers: 0,
    scheduledJobs: 0,
    activePaintStrokes: 0,
    activeTransactions: 0,
    cachedUVTopologies: 0,
    cachedImageComposites: 0,
  };
}

/** Mutable counters with a floor of zero so dispose/cancel cannot go negative. */
export class ResourceDiagnosticsTracker {
  private readonly counts: SDKResourceDiagnostics = emptyResourceDiagnostics();

  increment(key: keyof SDKResourceDiagnostics, amount = 1): void {
    if (amount <= 0) {
      return;
    }
    this.counts[key] += amount;
  }

  decrement(key: keyof SDKResourceDiagnostics, amount = 1): void {
    if (amount <= 0) {
      return;
    }
    this.counts[key] = Math.max(0, this.counts[key] - amount);
  }

  snapshot(): SDKResourceDiagnostics {
    return { ...this.counts };
  }

  reset(): void {
    for (const key of Object.keys(this.counts) as (keyof SDKResourceDiagnostics)[]) {
      this.counts[key] = 0;
    }
  }
}
