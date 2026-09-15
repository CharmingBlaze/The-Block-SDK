import type { MeshId, ObjectId, VertexId } from "@modeling-kit/core";
import type { TransformData, Vec3, Quat } from "@modeling-kit/math";

export type TransformMode = "translate" | "rotate" | "scale";
export type TransformSpace = "world" | "local" | "parent" | "view" | "normal";
export type TransformPivot = "individual" | "median" | "bounds" | "active" | "cursor";

export interface TransformSnapOptions {
  readonly grid?: number;
  readonly increment?: number;
  readonly angle?: number;
  readonly vertexRadius?: number;
}

export interface TransformRequest {
  readonly mode: TransformMode;
  readonly space?: TransformSpace;
  readonly pivot?: TransformPivot;
  readonly cursor?: Vec3;
  readonly objectIds?: readonly ObjectId[];
  readonly meshId?: MeshId;
  readonly vertexIds?: readonly VertexId[];
  readonly activeId?: string | null;
  readonly axis?: Vec3;
  /** Camera orientation for `space: "view"`. Local +Y is up in view if omitted, identity. */
  readonly viewRotation?: Quat;
  /** Selection/face normal for `space: "normal"`. Defaults to +Y. */
  readonly normal?: Vec3;
  readonly snap?: TransformSnapOptions;
}

export interface TransformDelta {
  readonly translation?: Vec3;
  readonly rotation?: { readonly axis: Vec3; readonly angle: number };
  readonly scale?: Vec3;
}

export interface ObjectTransformPatch {
  readonly objectId: ObjectId;
  readonly before: TransformData;
  readonly after: TransformData;
}

export interface VertexPositionPatch {
  readonly meshId: MeshId;
  readonly vertexId: VertexId;
  readonly before: readonly [number, number, number];
  readonly after: readonly [number, number, number];
}

export interface TransformSnapshot {
  readonly objects: readonly ObjectTransformPatch[];
  readonly vertices: readonly VertexPositionPatch[];
}
