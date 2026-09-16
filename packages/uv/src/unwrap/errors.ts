import type { CornerId, EdgeId, FaceId } from "@modeling-kit/core";

export type UvUnwrapErrorCode =
  | "empty-mesh"
  | "empty-selection"
  | "invalid-indices"
  | "degenerate-triangle"
  | "non-finite-position"
  | "invalid-triangulation"
  | "missing-corner-mapping"
  | "conflicting-corner-uv"
  | "pinned-uv"
  | "backend-init-failed"
  | "cancelled"
  | "wasm-allocation-failed"
  | "invalid-atlas"
  | "unsupported-option"
  | "disposed";

export class UvUnwrapError extends Error {
  readonly code: UvUnwrapErrorCode;
  readonly cornerIds: readonly CornerId[];
  readonly faceIds: readonly FaceId[];
  readonly edgeIds: readonly EdgeId[];

  constructor(
    code: UvUnwrapErrorCode,
    message: string,
    details: {
      readonly cornerIds?: readonly CornerId[];
      readonly faceIds?: readonly FaceId[];
      readonly edgeIds?: readonly EdgeId[];
    } = {},
  ) {
    super(message);
    this.name = "UvUnwrapError";
    this.code = code;
    this.cornerIds = details.cornerIds ?? [];
    this.faceIds = details.faceIds ?? [];
    this.edgeIds = details.edgeIds ?? [];
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new UvUnwrapError("cancelled", "Automatic chart unwrap was cancelled");
  }
}
