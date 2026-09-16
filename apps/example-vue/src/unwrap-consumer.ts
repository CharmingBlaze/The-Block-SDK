import { automaticUnwrap, type AutomaticUvUnwrapRequest } from "@modeling-kit/sdk";

/** Proves a Vite/Vue consumer can import automatic chart unwrap from the SDK. */
export async function unwrapImportedMesh(request: AutomaticUvUnwrapRequest) {
  return automaticUnwrap(request);
}
