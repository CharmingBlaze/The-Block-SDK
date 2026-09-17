export type PointerGestureOwner = "selection" | "tool" | "gizmo" | "navigation" | "none";

export type PointerGestureClaim =
  | { owner: "selection" }
  | { owner: "tool"; beginDrag?: boolean }
  | { owner: "gizmo"; beginDrag?: boolean }
  | { owner: "navigation" }
  | { owner: "none" }
  | undefined;

export interface PointerGestureContext {
  readonly event: PointerEvent;
  readonly pointerId: number;
  readonly owner: PointerGestureOwner | "idle";
  readonly canvas: HTMLCanvasElement;
}

export interface ViewportGestureHooks {
  onPointerDown?(context: PointerGestureContext): PointerGestureClaim;
  onPointerMove?(context: PointerGestureContext): void;
  onPointerUp?(context: PointerGestureContext): void;
  onPointerCancel?(context: PointerGestureContext): void;
}

export type ViewportNavigationMouseAction = "none" | "orbit" | "pan" | "dolly";
export type ViewportNavigationWheelAction = "none" | "dolly";
export type ViewportNavigationOneFinger = "none" | "orbit" | "pan";
export type ViewportNavigationTwoFinger = "none" | "dolly-pan" | "dolly-orbit";

export interface ViewportNavigationConfig {
  readonly mouseButtons: {
    readonly left: ViewportNavigationMouseAction;
    readonly middle: ViewportNavigationMouseAction;
    readonly right: ViewportNavigationMouseAction;
  };
  readonly wheel: ViewportNavigationWheelAction;
  readonly touch: {
    readonly oneFinger: ViewportNavigationOneFinger;
    readonly twoFinger: ViewportNavigationTwoFinger;
  };
}

export type ViewportGestureCancelReason =
  | "selection-start"
  | "pointercancel"
  | "lostpointercapture"
  | "blur"
  | "dispose"
  | "canvas-removed"
  | "host"
  | (string & {});

export interface ViewportGestureHitTester {
  hitTest(context: PointerGestureContext): PointerGestureClaim;
  onPointerMove?(context: PointerGestureContext): void;
  onPointerUp?(context: PointerGestureContext): void;
  onPointerCancel?(context: PointerGestureContext): void;
}

export interface ViewportGestureController {
  readonly owner: PointerGestureOwner | "idle";
  ownerOf(pointerId: number): PointerGestureOwner | "idle";
  hasCapturedPointers(): boolean;
  setHooks(hooks: ViewportGestureHooks | undefined): void;
  registerGizmo(handler: ViewportGestureHitTester): () => void;
  registerTool(handler: ViewportGestureHitTester): () => void;
  setNavigation(config: DeepPartialViewportNavigation): void;
  getNavigation(): ViewportNavigationConfig;
  applyClaim(pointerId: number, claim: Exclude<PointerGestureClaim, undefined>): boolean;
  cancelActiveGesture(reason?: ViewportGestureCancelReason): void;
  /** Re-applies public OrbitControls mouse/touch/wheel maps. */
  enforceNavigation(): void;
  dispose(): void;
}

export type DeepPartialViewportNavigation = {
  readonly mouseButtons?: Partial<ViewportNavigationConfig["mouseButtons"]>;
  readonly wheel?: ViewportNavigationWheelAction;
  readonly touch?: Partial<ViewportNavigationConfig["touch"]>;
};

export const DEFAULT_PICKING_NAVIGATION: ViewportNavigationConfig = {
  mouseButtons: {
    left: "none",
    middle: "pan",
    right: "orbit",
  },
  wheel: "dolly",
  touch: {
    oneFinger: "none",
    twoFinger: "none",
  },
};
