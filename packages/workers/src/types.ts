import type { SerializedMesh } from "@modeling-kit/mesh";
import type { PackUvsOptions } from "@modeling-kit/uv";
import type { UnwrapUvTaskPayload } from "./unwrap-task-types";

export type { UnwrapUvTaskPayload } from "./unwrap-task-types";

export type TaskType = "triangulate" | "pack-uv" | "validate" | "unwrap-uv";

export interface TriangulateTaskPayload {
  readonly serializedMesh: SerializedMesh;
}

export interface PackUvsTaskPayload {
  readonly serializedMesh: SerializedMesh;
  readonly options?: PackUvsOptions | undefined;
}

export interface ValidateTaskPayload {
  readonly serializedMesh: SerializedMesh;
}

export type TaskPayload =
  | { readonly type: "triangulate"; readonly payload: TriangulateTaskPayload }
  | { readonly type: "pack-uv"; readonly payload: PackUvsTaskPayload }
  | { readonly type: "validate"; readonly payload: ValidateTaskPayload }
  | { readonly type: "unwrap-uv"; readonly payload: UnwrapUvTaskPayload };

export interface WorkerTaskRequest {
  readonly id: string;
  readonly task: TaskPayload;
  readonly signal?: AbortSignal;
}

export interface WorkerTaskSuccessResponse<T = unknown> {
  readonly id: string;
  readonly success: true;
  readonly result: T;
}

export interface WorkerTaskErrorResponse {
  readonly id: string;
  readonly success: false;
  readonly error: string;
}

export type WorkerTaskResponse<T = unknown> =
  WorkerTaskSuccessResponse<T> | WorkerTaskErrorResponse;
