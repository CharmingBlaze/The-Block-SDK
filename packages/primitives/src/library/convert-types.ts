import type { MeshId, VertexId } from "@modeling-kit/core";
import type { PrimitiveResult } from "../types";
import type { WeldPolicy } from "./weld-policy";

export interface SimplicialComplexInput {
  readonly positions: ArrayLike<number>;
  readonly cells: ArrayLike<number>;
  readonly normals?: ArrayLike<number> | undefined;
  readonly uvs?: ArrayLike<number> | undefined;
}

export type CellOrientation = "preserve" | "outward-from-origin" | "positive-y";

export interface ConvertSimplicialOptions {
  readonly type?: string;
  readonly meshId?: MeshId;
  readonly cellSize?: 3 | 4;
  readonly remapXyToXz?: boolean;
  readonly smooth?: boolean;
  readonly orientation?: CellOrientation;
  readonly weld?: WeldPolicy;
}

export interface ConvertedPrimitive extends PrimitiveResult {
  readonly sourceIndexToVertex: readonly VertexId[];
  readonly library: NonNullable<PrimitiveResult["library"]>;
}

export interface CellSpec {
  readonly source: number[];
  readonly vertices: VertexId[];
  readonly uvs: [number, number][];
  readonly normals: [number, number, number][] | undefined;
}

export interface Aabb {
  readonly min: [number, number, number];
  readonly span: [number, number, number];
}

export const UV_SEAM_DELTA = 1e-4;
