import type { MeshVisualLifecycle } from "./lifecycle";

export interface SubElementDiagnostics {
  lifecycle: MeshVisualLifecycle;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  pendingDirtyFlags: number;
  flushCount: number;
  topologyRebuildCount: number;
  partialUpdateCount: number;
  activeSubscriptions: number;
  activeResources: number;
  pendingJobs: number;
  lastUpdateDurationMs: number;
  lastFailure?: string;
}

export function emptyDiagnostics(lifecycle: MeshVisualLifecycle = "uninitialized"): SubElementDiagnostics {
  return {
    lifecycle,
    vertexCount: 0,
    edgeCount: 0,
    faceCount: 0,
    pendingDirtyFlags: 0,
    flushCount: 0,
    topologyRebuildCount: 0,
    partialUpdateCount: 0,
    activeSubscriptions: 0,
    activeResources: 0,
    pendingJobs: 0,
    lastUpdateDurationMs: 0,
  };
}
