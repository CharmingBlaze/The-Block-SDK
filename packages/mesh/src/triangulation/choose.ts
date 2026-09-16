import type { TriangulationBackendId, TriangulationBackendUsed, Vec2 } from "./types";
import { isConvexCCW } from "./validate-input";

export function chooseTriangulationBackend(
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
  requested: TriangulationBackendId,
): TriangulationBackendUsed {
  if (holes.length > 0) {
    return "earcut";
  }
  if (requested === "earclip" || requested === "earcut") {
    return requested;
  }
  return isConvexCCW(outer) ? "earclip" : "earcut";
}
