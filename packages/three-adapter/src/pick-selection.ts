import type { ModelingSession } from "@modeling-kit/commands";
import type { PickResult } from "./picking";

export const VIEWPORT_CLICK_SLOP_PX = 4;

export function clientToNdc(
  clientX: number,
  clientY: number,
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    x: ((clientX - rect.left) / width) * 2 - 1,
    y: -(((clientY - rect.top) / height) * 2 - 1),
  };
}

/** Applies a viewport pick to session selection. Misses clear the selection. */
export function applyPickSelection(session: ModelingSession, hit: PickResult | null): void {
  if (!hit) {
    session.selection.clear();
    return;
  }
  if (hit.domain === "object") {
    session.selection.replace({
      domain: "object",
      objectIds: [hit.objectId],
      elementIds: [],
    });
    return;
  }
  session.selection.replace({
    domain: hit.domain,
    objectId: hit.objectId,
    elementIds: [hit.elementId],
  });
}

export function isClickNotDrag(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  slopPx = VIEWPORT_CLICK_SLOP_PX,
): boolean {
  return Math.hypot(endX - startX, endY - startY) <= slopPx;
}
