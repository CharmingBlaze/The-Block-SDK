export type MeshIssueCode =
  | "ZERO_LENGTH_EDGE"
  | "NON_MANIFOLD_EDGE"
  | "DEGENERATE_FACE"
  | "CONSECUTIVE_DUPLICATE_VERTICES"
  | "ISOLATED_VERTEX"
  | "NON_MANIFOLD_VERTEX"
  | "NON_FINITE_POSITION"
  | "DANGLING_HALF_EDGE"
  | "INCONSISTENT_WINDING"
  | "INVALID_CREASE_WEIGHT"
  | "MISSING_TWIN_LINK"
  | "INVALID_NEXT_PREV_LINK"
  | "ORPHANED_CORNER"
  | "DUPLICATE_DIRECTED_EDGE"
  | "INVALID_CORNER_REFERENCE"
  | "MISSING_VERTEX_REFERENCE"
  | "INVALID_ATTRIBUTE_ARRAY_LENGTH"
  | "NON_FINITE_ATTRIBUTE_VALUE";

export interface MeshIssue {
  readonly code: MeshIssueCode;
  readonly message: string;
  readonly elementIds: readonly string[];
  readonly recoverable: boolean;
}

export interface MeshStatistics {
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly faceCount: number;
  readonly boundaryEdgeCount: number;
  readonly isManifold: boolean;
  readonly isClosed: boolean;
}

export interface MeshValidationResult {
  readonly valid: boolean;
  readonly errors: readonly MeshIssue[];
  readonly warnings: readonly MeshIssue[];
  readonly statistics: MeshStatistics;
}

export interface MeshCleanupReport {
  readonly isolatedVerticesRemoved: number;
  readonly edgesCollapsed: number;
  readonly duplicateFacesRemoved: number;
  readonly facesRewound: number;
  readonly remaining: MeshValidationResult;
}
