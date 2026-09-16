import { automaticUnwrap, type AutomaticUvUnwrapRequest } from "@modeling-kit/sdk";

/** Proves a Vite/React consumer can import automatic chart unwrap from the SDK. */
export async function unwrapImportedMesh(request: AutomaticUvUnwrapRequest) {
  return automaticUnwrap(request);
}
