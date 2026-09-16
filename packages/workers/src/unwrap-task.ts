import { XAtlasUnwrapBackend, type UvUnwrapBackendInput, type UvUnwrapBackendOptions } from "@modeling-kit/uv";

let backend: XAtlasUnwrapBackend | null = null;

export async function runUnwrapUvTask(
  input: UvUnwrapBackendInput,
  options: UvUnwrapBackendOptions,
  signal?: AbortSignal,
): Promise<import("@modeling-kit/uv").UvUnwrapBackendResult> {
  backend ??= new XAtlasUnwrapBackend();
  await backend.initialize();
  return backend.unwrap(input, options, signal);
}
