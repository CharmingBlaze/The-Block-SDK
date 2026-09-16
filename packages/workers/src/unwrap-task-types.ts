import type { UvUnwrapBackendInput, UvUnwrapBackendOptions } from "@modeling-kit/uv";

export type UnwrapUvTaskType = "unwrap-uv";

export interface UnwrapUvTaskPayload {
  readonly input: UvUnwrapBackendInput;
  readonly options: UvUnwrapBackendOptions;
}
