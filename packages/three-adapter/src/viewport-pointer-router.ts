import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createOrbitEventGate } from "./orbit-event-gate";
import { createViewportGestureController } from "./viewport-gesture-controller";
import { resolvePickingNavigation, type PickingOrbitPointerMap } from "./viewport-pointer-policy";

/** @deprecated Use `PointerGestureOwner` from the viewport gesture controller. */
export type ViewportPointerOwner = "idle" | "tool" | "pick" | "orbit";

/** @deprecated Use `ViewportGestureController`. */
export interface ViewportPointerRouter {
  readonly owner: ViewportPointerOwner;
  beginToolDrag(pointerId: number): boolean;
  releasePointer(pointerId: number): void;
  enforceOrbitMap(): void;
  dispose(): void;
}

export interface ViewportPointerRouterOptions {
  readonly canvas: HTMLCanvasElement;
  readonly pickingEnabled: boolean;
  readonly orbitMap: PickingOrbitPointerMap;
  getControls(): OrbitControls | undefined;
  onLeftDown(event: PointerEvent): void;
  onLeftMove(event: PointerEvent): void;
  onLeftUp(event: PointerEvent): void;
  onLeftCancel(event: PointerEvent): void;
}

function toLegacyOwner(owner: string): ViewportPointerOwner {
  if (owner === "selection") {
    return "pick";
  }
  if (owner === "navigation") {
    return "orbit";
  }
  if (owner === "tool") {
    return "tool";
  }
  return "idle";
}

/**
 * @deprecated Use `createViewportGestureController`. Kept as a compatibility facade.
 */
export function bindViewportPointerRouter(options: ViewportPointerRouterOptions): ViewportPointerRouter {
  const gate = createOrbitEventGate(options.canvas);
  const navigation = resolvePickingNavigation();
  const gestures = createViewportGestureController({
    canvas: options.canvas,
    attachListeners: options.pickingEnabled,
    pickingEnabled: options.pickingEnabled,
    navigation,
    minDistance: options.orbitMap.minDistance,
    zoomToCursor: options.orbitMap.zoomToCursor,
    getControls: options.getControls,
    getNavigationTarget: () => gate,
    onSelectionDown: options.onLeftDown,
    onSelectionMove: options.onLeftMove,
    onSelectionUp: options.onLeftUp,
    onSelectionCancel: options.onLeftCancel,
  });

  return {
    get owner() {
      return toLegacyOwner(gestures.owner);
    },
    beginToolDrag(pointerId: number) {
      return gestures.applyClaim(pointerId, { owner: "tool", beginDrag: true });
    },
    releasePointer(pointerId: number) {
      if (gestures.ownerOf(pointerId) !== "idle") {
        gestures.cancelActiveGesture("host");
      }
    },
    enforceOrbitMap() {
      gestures.enforceNavigation();
    },
    dispose() {
      gestures.dispose();
    },
  };
}
