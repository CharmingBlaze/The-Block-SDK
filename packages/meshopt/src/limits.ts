export interface MeshoptLimits {
  readonly maxVertices: number;
  readonly maxIndices: number;
  readonly maxBytes: number;
  readonly timeoutMs: number;
  readonly minTriangles: number;
}

export const DEFAULT_MESHOPT_LIMITS: MeshoptLimits = {
  maxVertices: 1_000_000,
  maxIndices: 3_000_000,
  maxBytes: 64 * 1024 * 1024,
  timeoutMs: 30_000,
  minTriangles: 1,
};

export function resolveLimits(overrides: Partial<MeshoptLimits> = {}): MeshoptLimits {
  return { ...DEFAULT_MESHOPT_LIMITS, ...overrides };
}
