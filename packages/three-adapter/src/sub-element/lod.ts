import type { SubElementLodOptions } from "./types";

export interface LodPlan {
  readonly stride: number;
  readonly selectionOnly: boolean;
  readonly visibleCount: number;
}

export function planElementLod(count: number, limit: number, options: SubElementLodOptions): LodPlan {
  if (options.strategy === "all" || count <= limit) {
    return { stride: 1, selectionOnly: false, visibleCount: count };
  }
  if (options.strategy === "selection-only") {
    return { stride: Number.POSITIVE_INFINITY, selectionOnly: true, visibleCount: 0 };
  }
  const stride = Math.max(2, Math.ceil(count / Math.max(1, limit)));
  return { stride, selectionOnly: false, visibleCount: Math.ceil(count / stride) };
}

export function isLodIndexVisible(index: number, plan: LodPlan, emphasized: boolean): boolean {
  if (emphasized) {
    return true;
  }
  if (plan.selectionOnly) {
    return false;
  }
  return index % plan.stride === 0;
}
