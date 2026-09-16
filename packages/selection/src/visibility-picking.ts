import type { PointPickRequest } from "./picking/pick-request";
import type { PointPickResult } from "./picking/pick-result";

/**
 * Renderer-neutral visible-surface picking. Implementations may use a GPU
 * ID-buffer, a CPU raycast, or another backend. Three.js types stay out of
 * this package.
 */
export type {
  PickBackfaceMode,
  PointPickApplyMode,
  PointPickDomain,
  PointPickRequest,
  PointPickResult,
  PointPickSource,
  ClientRectLike,
  ViewportRect,
  HoverPickPolicy,
} from "./picking";
export { defaultHoverPickPolicy } from "./picking";

export interface VisibilityPickingAdapter {
  pickPoint(request: PointPickRequest): Promise<PointPickResult | undefined>;
  dispose(): void;
}
