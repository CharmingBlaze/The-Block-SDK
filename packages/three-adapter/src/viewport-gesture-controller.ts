import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { OrbitEventGate } from "./orbit-event-gate";
import {
  applyViewportNavigation,
  mergeViewportNavigation,
  type PickingOrbitPointerMapOptions,
} from "./viewport-pointer-policy";
import type {
  DeepPartialViewportNavigation,
  PointerGestureClaim,
  PointerGestureContext,
  PointerGestureOwner,
  ViewportGestureCancelReason,
  ViewportGestureController,
  ViewportGestureHitTester,
  ViewportGestureHooks,
  ViewportNavigationConfig,
} from "./viewport-gesture-types";
import { DEFAULT_PICKING_NAVIGATION } from "./viewport-gesture-types";

export interface ViewportGestureControllerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly attachListeners: boolean;
  readonly pickingEnabled: boolean;
  readonly navigation: ViewportNavigationConfig;
  readonly minDistance?: number;
  readonly zoomToCursor?: boolean;
  getControls(): OrbitControls | undefined;
  getNavigationTarget(): OrbitEventGate | undefined;
  onSelectionDown(event: PointerEvent): void;
  onSelectionMove(event: PointerEvent): void;
  onSelectionUp(event: PointerEvent): void;
  onSelectionCancel(event: PointerEvent): void;
}

interface ActivePointer {
  owner: PointerGestureOwner;
  captured: boolean;
  pointerType: string;
  button: number;
  startX: number;
  startY: number;
}

const LISTENER_OPTS: AddEventListenerOptions = { capture: true };
const LEFT_DRAG_SLOP_PX = 6;

function mouseButtonAction(
  navigation: ViewportNavigationConfig,
  button: number,
): ViewportNavigationConfig["mouseButtons"][keyof ViewportNavigationConfig["mouseButtons"]] {
  if (button === 1) {
    return navigation.mouseButtons.middle;
  }
  if (button === 2) {
    return navigation.mouseButtons.right;
  }
  return navigation.mouseButtons.left;
}

function touchNavigationEnabled(navigation: ViewportNavigationConfig): boolean {
  return navigation.touch.oneFinger !== "none" || navigation.touch.twoFinger !== "none";
}

function isLeftMouse(event: PointerEvent): boolean {
  return event.pointerType !== "touch" && event.button === 0;
}

function syntheticPointer(type: string, pointerId: number, extra: Record<string, unknown> = {}): PointerEvent {
  if (typeof PointerEvent === "function") {
    return new PointerEvent(type, {
      pointerId,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
  }
  const event = new Event(type) as PointerEvent;
  Object.assign(event, { pointerId, button: 0, buttons: 0, ...extra });
  return event;
}

export function createViewportGestureController(
  options: ViewportGestureControllerOptions,
): ViewportGestureController {
  const { canvas } = options;
  const pointers = new Map<number, ActivePointer>();
  const gizmos = new Set<ViewportGestureHitTester>();
  const tools = new Set<ViewportGestureHitTester>();
  const hostOwned = new Set<number>();
  let hooks: ViewportGestureHooks | undefined;
  let navigation = mergeViewportNavigation(DEFAULT_PICKING_NAVIGATION, options.navigation);
  let disposed = false;
  let releasingCapture = false;

  const view = (): Window | null => {
    const doc = canvas.ownerDocument;
    return doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
  };

  const context = (event: PointerEvent): PointerGestureContext => ({
    event,
    pointerId: event.pointerId,
    owner: pointers.get(event.pointerId)?.owner ?? "idle",
    canvas,
  });

  const applyNavToControls = (): void => {
    const controls = options.getControls();
    if (!controls) {
      return;
    }
    const mapOptions: PickingOrbitPointerMapOptions = {
      navigation,
      ...(options.minDistance !== undefined ? { minDistance: options.minDistance } : {}),
      ...(options.zoomToCursor !== undefined ? { zoomToCursor: options.zoomToCursor } : {}),
    };
    applyViewportNavigation(controls, navigation, mapOptions);
  };

  const capturePointer = (pointerId: number): void => {
    const active = pointers.get(pointerId);
    if (!active || active.captured) {
      return;
    }
    try {
      canvas.setPointerCapture(pointerId);
      active.captured = true;
    } catch {
      // Capture APIs are optional in tests and some embeds.
    }
  };

  const releasePointerCapture = (pointerId: number): void => {
    const active = pointers.get(pointerId);
    releasingCapture = true;
    try {
      if (typeof canvas.hasPointerCapture !== "function" || canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // already released or unsupported
    } finally {
      releasingCapture = false;
      if (active) {
        active.captured = false;
      }
    }
  };

  const forwardNavigation = (event: Event): void => {
    options.getNavigationTarget()?.invoke(event);
  };

  const notifyOwner = (phase: "move" | "up" | "cancel", event: PointerEvent, owner: PointerGestureOwner): void => {
    const ctx = context(event);
    if (phase === "move") {
      hooks?.onPointerMove?.(ctx);
    } else if (phase === "up") {
      hooks?.onPointerUp?.(ctx);
    } else {
      hooks?.onPointerCancel?.(ctx);
    }
    const handlers = owner === "gizmo" ? gizmos : owner === "tool" ? tools : undefined;
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      if (phase === "move") {
        handler.onPointerMove?.(ctx);
      } else if (phase === "up") {
        handler.onPointerUp?.(ctx);
      } else {
        handler.onPointerCancel?.(ctx);
      }
    }
  };

  const resetNavigation = (pointerId: number): void => {
    const target = options.getNavigationTarget();
    if (!target) {
      return;
    }
    const cancel = syntheticPointer("pointercancel", pointerId, { pointerType: "mouse" });
    target.invoke(cancel);
    const up = syntheticPointer("pointerup", pointerId, { button: 0, buttons: 0, pointerType: "mouse" });
    canvas.ownerDocument?.dispatchEvent?.(up);
  };

  const clearPointer = (pointerId: number, reason: ViewportGestureCancelReason, event?: PointerEvent): void => {
    const active = pointers.get(pointerId);
    if (!active) {
      return;
    }
    if (event && (reason === "pointercancel" || reason === "lostpointercapture" || reason === "blur" || reason === "dispose" || reason === "canvas-removed" || reason === "host" || reason === "selection-start")) {
      notifyOwner("cancel", event, active.owner);
      if (active.owner === "selection") {
        options.onSelectionCancel(event);
      }
    }
    if (active.owner === "navigation") {
      resetNavigation(pointerId);
    }
    releasePointerCapture(pointerId);
    pointers.delete(pointerId);
    hostOwned.delete(pointerId);
  };

  const cancelActiveGesture = (reason: ViewportGestureCancelReason = "host"): void => {
    const ids = [...pointers.keys()];
    const event = syntheticPointer("pointercancel", ids[0] ?? 0);
    for (const pointerId of ids) {
      Object.assign(event, { pointerId });
      clearPointer(pointerId, reason, event);
    }
  };

  const beginOwned = (event: PointerEvent, claim: Exclude<PointerGestureClaim, undefined>): void => {
    pointers.set(event.pointerId, {
      owner: claim.owner,
      captured: false,
      pointerType: event.pointerType,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
    });
    if ((claim.owner === "tool" || claim.owner === "gizmo") && "beginDrag" in claim && claim.beginDrag) {
      capturePointer(event.pointerId);
    }
    if (claim.owner === "navigation") {
      applyNavToControls();
      forwardNavigation(event);
    }
    if (claim.owner === "selection") {
      options.onSelectionDown(event);
    }
  };

  const resolveClaim = (event: PointerEvent): Exclude<PointerGestureClaim, undefined> => {
    const ctx = context(event);
    const hostClaim = hooks?.onPointerDown?.(ctx);
    if (hostClaim) {
      hostOwned.add(event.pointerId);
      return hostClaim;
    }

    if (event.pointerType === "touch") {
      if (touchNavigationEnabled(navigation)) {
        return { owner: "navigation" };
      }
      return { owner: "none" };
    }

    if (isLeftMouse(event)) {
      for (const gizmo of gizmos) {
        const claim = gizmo.hitTest(ctx);
        if (claim) {
          return claim;
        }
      }
      for (const tool of tools) {
        const claim = tool.hitTest(ctx);
        if (claim) {
          return claim;
        }
      }
      if (options.pickingEnabled) {
        return { owner: "selection" };
      }
      if (mouseButtonAction(navigation, 0) !== "none") {
        return { owner: "navigation" };
      }
      return { owner: "none" };
    }

    if (mouseButtonAction(navigation, event.button) !== "none") {
      return { owner: "navigation" };
    }
    return { owner: "none" };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) {
      return;
    }
    applyNavToControls();
    if (!canvas.isConnected && canvas.isConnected !== undefined) {
      cancelActiveGesture("canvas-removed");
      return;
    }
    const claim = resolveClaim(event);
    beginOwned(event, claim);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) {
      return;
    }
    const active = pointers.get(event.pointerId);
    const owner = active?.owner ?? "idle";
    if (active && (hostOwned.has(event.pointerId) || hooks?.onPointerMove)) {
      hooks?.onPointerMove?.(context(event));
    }
    // When configured, left press begins as a selection candidate. It only
    // becomes orbit after meaningful travel, so a click remains selection.
    if (
      active?.owner === "selection" &&
      active.button === 0 &&
      mouseButtonAction(navigation, 0) !== "none" &&
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= LEFT_DRAG_SLOP_PX
    ) {
      options.onSelectionCancel(event);
      active.owner = "navigation";
      applyNavToControls();
      forwardNavigation(
        syntheticPointer("pointerdown", event.pointerId, {
          pointerType: active.pointerType,
          button: active.button,
          buttons: 1,
          clientX: active.startX,
          clientY: active.startY,
          pageX: active.startX,
          pageY: active.startY,
        }),
      );
      forwardNavigation(event);
      return;
    }
    if (owner === "navigation") {
      forwardNavigation(event);
      return;
    }
    if (owner === "selection") {
      options.onSelectionMove(event);
    } else if (owner === "idle" && (event.buttons & 1) === 0 && options.pickingEnabled) {
      options.onSelectionMove(event);
    } else if (owner === "gizmo" || owner === "tool") {
      const ctx = context(event);
      const handlers = owner === "gizmo" ? gizmos : tools;
      for (const handler of handlers) {
        handler.onPointerMove?.(ctx);
      }
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) {
      return;
    }
    const active = pointers.get(event.pointerId);
    if (!active) {
      return;
    }
    if (hostOwned.has(event.pointerId) || hooks?.onPointerUp) {
      hooks?.onPointerUp?.(context(event));
    }
    if (active.owner === "navigation") {
      forwardNavigation(event);
    } else if (active.owner === "selection") {
      options.onSelectionUp(event);
    } else if (active.owner === "gizmo" || active.owner === "tool") {
      const ctx = context(event);
      const handlers = active.owner === "gizmo" ? gizmos : tools;
      for (const handler of handlers) {
        handler.onPointerUp?.(ctx);
      }
    }
    releasePointerCapture(event.pointerId);
    pointers.delete(event.pointerId);
    hostOwned.delete(event.pointerId);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    clearPointer(event.pointerId, "pointercancel", event);
  };

  const onLostCapture = (event: PointerEvent): void => {
    if (releasingCapture) {
      return;
    }
    clearPointer(event.pointerId, "lostpointercapture", event);
  };

  const onBlur = (): void => {
    cancelActiveGesture("blur");
  };

  const onWheel = (event: WheelEvent): void => {
    if (disposed) {
      return;
    }
    applyNavToControls();
    const dragging = [...pointers.values()].some(
      (pointer) => pointer.owner === "tool" || pointer.owner === "gizmo" || pointer.owner === "selection",
    );
    if (dragging || navigation.wheel !== "dolly") {
      return;
    }
    forwardNavigation(event);
  };

  const onContextMenu = (event: Event): void => {
    if ([...pointers.values()].some((pointer) => pointer.owner === "navigation")) {
      forwardNavigation(event);
    }
  };

  const onLostCanvas = (): void => {
    if (canvas.isConnected === false) {
      cancelActiveGesture("canvas-removed");
    }
  };

  let mutationObserver: MutationObserver | undefined;

  if (options.attachListeners) {
    canvas.addEventListener("pointerdown", onPointerDown, LISTENER_OPTS);
    canvas.addEventListener("pointermove", onPointerMove, LISTENER_OPTS);
    canvas.addEventListener("pointerup", onPointerUp, LISTENER_OPTS);
    canvas.addEventListener("pointercancel", onPointerCancel, LISTENER_OPTS);
    canvas.addEventListener("lostpointercapture", onLostCapture, LISTENER_OPTS);
    canvas.addEventListener("wheel", onWheel, { capture: true, passive: false });
    canvas.addEventListener("contextmenu", onContextMenu, LISTENER_OPTS);
    view()?.addEventListener("blur", onBlur);
    if (typeof MutationObserver !== "undefined" && canvas.parentNode) {
      mutationObserver = new MutationObserver(onLostCanvas);
      mutationObserver.observe(canvas.parentNode, { childList: true });
    }
  }

  const controller: ViewportGestureController = {
    get owner() {
      if (pointers.size === 0) {
        return "idle";
      }
      return [...pointers.values()][pointers.size - 1]!.owner;
    },
    ownerOf(pointerId) {
      return pointers.get(pointerId)?.owner ?? "idle";
    },
    hasCapturedPointers() {
      if (typeof canvas.hasPointerCapture === "function") {
        return [...pointers.values()].some((pointer) => pointer.captured);
      }
      return [...pointers.values()].some((pointer) => pointer.captured);
    },
    setHooks(next) {
      hooks = next;
    },
    registerGizmo(handler) {
      gizmos.add(handler);
      return () => {
        gizmos.delete(handler);
      };
    },
    registerTool(handler) {
      tools.add(handler);
      return () => {
        tools.delete(handler);
      };
    },
    setNavigation(config: DeepPartialViewportNavigation) {
      navigation = mergeViewportNavigation(navigation, config);
      applyNavToControls();
    },
    getNavigation() {
      return mergeViewportNavigation(navigation);
    },
    applyClaim(pointerId, claim) {
      const active = pointers.get(pointerId);
      if (!active) {
        return false;
      }
      if (active.owner === "gizmo" && claim.owner !== "gizmo") {
        return false;
      }
      if (active.owner === "navigation" && claim.owner !== "navigation") {
        return false;
      }
      active.owner = claim.owner;
      if ((claim.owner === "tool" || claim.owner === "gizmo") && "beginDrag" in claim && claim.beginDrag) {
        capturePointer(pointerId);
      }
      return true;
    },
    cancelActiveGesture,
    enforceNavigation() {
      applyNavToControls();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      cancelActiveGesture("dispose");
      if (!options.attachListeners) {
        return;
      }
      canvas.removeEventListener("pointerdown", onPointerDown, LISTENER_OPTS);
      canvas.removeEventListener("pointermove", onPointerMove, LISTENER_OPTS);
      canvas.removeEventListener("pointerup", onPointerUp, LISTENER_OPTS);
      canvas.removeEventListener("pointercancel", onPointerCancel, LISTENER_OPTS);
      canvas.removeEventListener("lostpointercapture", onLostCapture, LISTENER_OPTS);
      canvas.removeEventListener("wheel", onWheel, { capture: true });
      canvas.removeEventListener("contextmenu", onContextMenu, LISTENER_OPTS);
      view()?.removeEventListener("blur", onBlur);
      mutationObserver?.disconnect();
    },
  };

  return controller;
}
