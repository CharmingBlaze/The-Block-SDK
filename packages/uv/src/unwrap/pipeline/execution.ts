import type { UvUnwrapBackend } from "../types";

export interface UnwrapExecutionOptions {
  readonly backend?: UvUnwrapBackend;
  readonly signal?: AbortSignal;
  readonly apply?: boolean;
}
