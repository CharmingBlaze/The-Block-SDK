import { MOUSE, TOUCH } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DEFAULT_PICKING_NAVIGATION,
  type DeepPartialViewportNavigation,
  type ViewportNavigationConfig,
  type ViewportNavigationMouseAction,
  type ViewportNavigationOneFinger,
  type ViewportNavigationTwoFinger,
} from "./viewport-gesture-types";

/** OrbitControls value meaning “this button / finger does nothing”. */
export const VIEWPORT_MOUSE_UNUSED = -1;

/**
 * Default `minDistance` when picking is on. A size-2 cube at the origin has AABB
 * half-extent 1; 2 keeps the default look-ray (and axis-aligned orbits) outside it.
 */
export const VIEWPORT_PICKING_MIN_DISTANCE = 2;

/** Absolute floor so a leaked pinch cannot reach distance 0 (mesh interior). */
export const VIEWPORT_PICKING_MIN_DISTANCE_FLOOR = 0.5;

/** Host gizmos must not mutate until the pointer travels at least this far. */
export const VIEWPORT_GIZMO_DRAG_SLOP_PX = 12;

export const DEFAULT_VIEWPORT_CAMERA_POSITION = [5, 5, 7] as const;

export interface PickingOrbitPointerMap {
  readonly mouseButtons: {
    readonly LEFT: number;
    readonly MIDDLE: number;
    readonly RIGHT: number;
  };
  readonly touches: {
    readonly ONE: number;
    readonly TWO: number;
  };
  readonly minDistance: number;
  readonly zoomToCursor: boolean;
}

export interface PickingOrbitPointerMapOptions {
  readonly minDistance?: number;
  readonly zoomToCursor?: boolean;
  /** When true, two-finger touch is dolly/pan. One-finger touch never orbits. */
  readonly touchNavigation?: boolean;
  readonly navigation?: DeepPartialViewportNavigation | undefined;
}

export function mergeViewportNavigation(
  base: ViewportNavigationConfig,
  patch?: DeepPartialViewportNavigation,
): ViewportNavigationConfig {
  if (!patch) {
    return {
      mouseButtons: { ...base.mouseButtons },
      wheel: base.wheel,
      touch: { ...base.touch },
    };
  }
  return {
    mouseButtons: { ...base.mouseButtons, ...patch.mouseButtons },
    wheel: patch.wheel ?? base.wheel,
    touch: { ...base.touch, ...patch.touch },
  };
}

export function resolvePickingNavigation(options: PickingOrbitPointerMapOptions = {}): ViewportNavigationConfig {
  const base = mergeViewportNavigation(DEFAULT_PICKING_NAVIGATION, {
    touch: {
      twoFinger: options.touchNavigation === true ? "dolly-pan" : DEFAULT_PICKING_NAVIGATION.touch.twoFinger,
    },
  });
  return mergeViewportNavigation(base, options.navigation);
}

export function mouseActionToOrbit(action: ViewportNavigationMouseAction): number {
  switch (action) {
    case "orbit":
      return MOUSE.ROTATE;
    case "pan":
      return MOUSE.PAN;
    case "dolly":
      return MOUSE.DOLLY;
    default:
      return VIEWPORT_MOUSE_UNUSED;
  }
}

export function touchOneToOrbit(action: ViewportNavigationOneFinger): number {
  switch (action) {
    case "orbit":
      return TOUCH.ROTATE;
    case "pan":
      return TOUCH.PAN;
    default:
      return VIEWPORT_MOUSE_UNUSED;
  }
}

export function touchTwoToOrbit(action: ViewportNavigationTwoFinger): number {
  switch (action) {
    case "dolly-pan":
      return TOUCH.DOLLY_PAN;
    case "dolly-orbit":
      return TOUCH.DOLLY_ROTATE;
    default:
      return VIEWPORT_MOUSE_UNUSED;
  }
}

/**
 * Button map used by `createThreeViewport` whenever picking is enabled.
 *
 * | Input | Action |
 * | Left click | Select (no capture, no orbit) |
 * | Left drag | Does not orbit |
 * | Right drag | Orbit |
 * | Middle drag | Pan |
 * | Wheel | Dolly |
 * | Touch | Only when `navigation.touch` is configured; never selection |
 */
export function createPickingOrbitPointerMap(
  options: PickingOrbitPointerMapOptions = {},
): PickingOrbitPointerMap {
  const navigation = resolvePickingNavigation(options);
  const minDistance = Math.max(
    options.minDistance ?? VIEWPORT_PICKING_MIN_DISTANCE,
    VIEWPORT_PICKING_MIN_DISTANCE_FLOOR,
  );
  return {
    mouseButtons: {
      LEFT: mouseActionToOrbit(navigation.mouseButtons.left),
      MIDDLE: mouseActionToOrbit(navigation.mouseButtons.middle),
      RIGHT: mouseActionToOrbit(navigation.mouseButtons.right),
    },
    touches: {
      ONE: touchOneToOrbit(navigation.touch.oneFinger),
      TWO: touchTwoToOrbit(navigation.touch.twoFinger),
    },
    minDistance,
    zoomToCursor: options.zoomToCursor === true,
  };
}

export function applyPickingOrbitPointerMap(
  controls: OrbitControls,
  map: PickingOrbitPointerMap,
): void {
  controls.mouseButtons = {
    LEFT: map.mouseButtons.LEFT as typeof MOUSE.ROTATE,
    MIDDLE: map.mouseButtons.MIDDLE as typeof MOUSE.PAN,
    RIGHT: map.mouseButtons.RIGHT as typeof MOUSE.ROTATE,
  };
  controls.touches = {
    ONE: map.touches.ONE as typeof TOUCH.ROTATE,
    TWO: map.touches.TWO as typeof TOUCH.DOLLY_PAN,
  };
  controls.minDistance = Math.max(controls.minDistance, map.minDistance);
  if (!map.zoomToCursor) {
    controls.zoomToCursor = false;
  }
}

export function applyViewportNavigation(
  controls: OrbitControls,
  navigation: ViewportNavigationConfig,
  options: { readonly minDistance?: number; readonly zoomToCursor?: boolean } = {},
): void {
  applyPickingOrbitPointerMap(
    controls,
    createPickingOrbitPointerMap({
      navigation,
      ...(options.minDistance !== undefined ? { minDistance: options.minDistance } : {}),
      ...(options.zoomToCursor !== undefined ? { zoomToCursor: options.zoomToCursor } : {}),
    }),
  );
  controls.enableZoom = navigation.wheel === "dolly";
}

export function isPointInsideAabb(
  point: { readonly x: number; readonly y: number; readonly z: number },
  min: { readonly x: number; readonly y: number; readonly z: number },
  max: { readonly x: number; readonly y: number; readonly z: number },
): boolean {
  return (
    point.x >= min.x &&
    point.x <= max.x &&
    point.y >= min.y &&
    point.y <= max.y &&
    point.z >= min.z &&
    point.z <= max.z
  );
}

/** Camera position if Orbit dollied in to `minDistance` along the current look ray. */
export function cameraAtMinDistanceOnLookRay(
  position: { readonly x: number; readonly y: number; readonly z: number },
  target: { readonly x: number; readonly y: number; readonly z: number },
  minDistance: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const dx = position.x - target.x;
  const dy = position.y - target.y;
  const dz = position.z - target.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-8) {
    return { x: target.x, y: target.y + minDistance, z: target.z };
  }
  const scale = minDistance / length;
  return {
    x: target.x + dx * scale,
    y: target.y + dy * scale,
    z: target.z + dz * scale,
  };
}
