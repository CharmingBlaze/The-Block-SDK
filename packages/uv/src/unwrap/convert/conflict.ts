import type { CornerId } from "@modeling-kit/core";
import { UV_CORNER_ASSIGNMENT_TOLERANCE } from "../constants";
import { UvUnwrapError } from "../errors";

export function assignOrRejectCornerUv(
  assigned: Map<CornerId, readonly [number, number]>,
  cornerId: CornerId,
  next: readonly [number, number],
): void {
  const previous = assigned.get(cornerId);
  if (!previous) {
    assigned.set(cornerId, next);
    return;
  }
  if (
    Math.abs(previous[0] - next[0]) > UV_CORNER_ASSIGNMENT_TOLERANCE ||
    Math.abs(previous[1] - next[1]) > UV_CORNER_ASSIGNMENT_TOLERANCE
  ) {
    throw new UvUnwrapError(
      "conflicting-corner-uv",
      `Canonical corner ${cornerId} received conflicting UVs from temporary triangulation`,
      { cornerIds: [cornerId] },
    );
  }
}
