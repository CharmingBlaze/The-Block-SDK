import type {
  CornerId,
  EdgeId,
  FaceId,
  IdFactory,
  VertexId,
} from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { restoreMesh, serializeMesh } from "../serialize";

/**
 * Distance, angle, and snapping thresholds for mesh operations.
 *
 * Orientation *signs* (left/right, CCW/CW, above/below, collinear/coplanar)
 * use `@modeling-kit/math` `GeometryPredicates`, not these epsilons.
 *
 * @see docs/guides/geometry-predicates.md
 */
export interface GeometryTolerance {
  readonly epsilon: number;
  readonly angleEpsilon: number;
}

export type ValidationMode = "strict" | "repair" | "warn";

export interface AttributePropagationPolicy {
  readonly interpolateUvs: boolean;
  readonly interpolateColors: boolean;
  readonly normalizeWeights: boolean;
  readonly preserveSeams: boolean;
  readonly preserveSharps: boolean;
}

export interface MeshOperationContext {
  readonly tolerance: GeometryTolerance;
  readonly idFactory: IdFactory;
  readonly validation: ValidationMode;
  readonly attributes: AttributePropagationPolicy;
}

export interface ElementMapping<TId> {
  readonly preserved: ReadonlySet<TId>;
  readonly deleted: ReadonlySet<TId>;
  readonly created: ReadonlySet<TId>;
  readonly replacedBy: ReadonlyMap<TId, readonly TId[]>;
  readonly derivedFrom: ReadonlyMap<TId, readonly TId[]>;
}

export interface TopologyMapping {
  readonly vertices: ElementMapping<VertexId>;
  readonly edges: ElementMapping<EdgeId>;
  readonly faces: ElementMapping<FaceId>;
  readonly corners: ElementMapping<CornerId>;
}

export interface SelectionSuggestion {
  readonly domain: "vertex" | "edge" | "face" | "object";
  readonly elementIds: readonly string[];
}

export interface MeshOperationWarning {
  readonly code: string;
  readonly message: string;
  readonly elementIds?: readonly string[];
}

export interface MeshChangeSet {
  readonly vertexCountDelta: number;
  readonly edgeCountDelta: number;
  readonly faceCountDelta: number;
  readonly cornerCountDelta: number;
}

export interface MeshOperationResult {
  readonly mesh: HalfEdgeMesh;
  readonly changes: MeshChangeSet;
  readonly mapping: TopologyMapping;
  readonly selection: SelectionSuggestion;
  readonly warnings: readonly MeshOperationWarning[];
}

export const defaultGeometryTolerance: GeometryTolerance = {
  epsilon: 1e-6,
  angleEpsilon: 1e-4,
};

export const defaultAttributePolicy: AttributePropagationPolicy = {
  interpolateUvs: true,
  interpolateColors: true,
  normalizeWeights: true,
  preserveSeams: true,
  preserveSharps: true,
};

export function createMeshOperationContext(
  idFactory: IdFactory,
  overrides: Partial<Omit<MeshOperationContext, "idFactory">> = {},
): MeshOperationContext {
  return {
    idFactory,
    tolerance: overrides.tolerance ?? defaultGeometryTolerance,
    validation: overrides.validation ?? "strict",
    attributes: overrides.attributes ?? defaultAttributePolicy,
  };
}

export function emptyElementMapping<TId>(): ElementMapping<TId> {
  return {
    preserved: new Set(),
    deleted: new Set(),
    created: new Set(),
    replacedBy: new Map(),
    derivedFrom: new Map(),
  };
}

/** Snapshot/restore so a thrown operator never leaves a half-mutated kernel. */
export function runTransactionalMeshOp<T>(mesh: HalfEdgeMesh, fn: () => T): T {
  const snapshot = serializeMesh(mesh);
  try {
    return fn();
  } catch (error) {
    restoreMesh(mesh, snapshot);
    throw error;
  }
}
