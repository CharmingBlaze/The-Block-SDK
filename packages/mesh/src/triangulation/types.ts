export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type TriangulationBackendId = "earclip" | "earcut" | "auto";
export type TriangulationBackendUsed = "earclip" | "earcut";

export type PolygonTriangulationStatus = "ok" | "degenerate" | "self-intersecting" | "failed";

export interface PolygonTriangulationOptions {
  readonly epsilon?: number;
  readonly rejectSelfIntersecting?: boolean;
  readonly backend?: TriangulationBackendId;
  readonly areaTolerance?: number;
  readonly holes?: readonly (readonly Vec3[])[];
}

export interface PolygonTriangulation {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly status: PolygonTriangulationStatus;
  readonly nonPlanar: boolean;
  readonly reversed: boolean;
  readonly backend: TriangulationBackendUsed;
  readonly sourceVertexIndices: readonly (readonly [number, number, number])[];
}

export interface PreparedLoop {
  readonly points: readonly Vec3[];
  readonly indices: readonly number[];
  readonly projected: readonly Vec2[];
}
