# Viewport Input Architecture

This document defines the input boundary for `@modeling-kit/three-adapter`.
Its purpose is to prevent selection, gizmo, tool, and camera-navigation
gestures from competing for the same browser event.

## Ownership boundary

When picking is on, `createThreeViewport` owns canvas pointer listeners through
`viewport.gestures` (`ViewportGestureController`). Hosts claim gestures with
hooks or registered gizmo/tool hit-tests. They must not add a second pointer
pipeline or mutate OrbitControls private state.

When picking is off (`picking: false`), the SDK attaches no canvas pointer
handlers. Custom hosts (including `@modeling-kit/input` `bindDom`) own the DOM.

| Concern | Host application | SDK (picking on) |
| --- | --- | --- |
| Canvas pointer listeners | Hooks / gizmo / tool registration | `ViewportGestureController` |
| Keyboard shortcuts and focused UI | Yes | No |
| Picking and selection | Requests / `consumePick` | Resolves and applies |
| Gizmo/tool hit testing | Registers handlers | Arbitrates ownership |
| Orbit/pan/dolly | `viewport.gestures.setNavigation` | Forwards only when owner is `navigation` |
| Pointer capture lifecycle | Requests `beginDrag` | Tracks and releases on up/cancel/blur/dispose |

OrbitControls must not listen directly to the canvas while picking is on. It is
bound to an internal event gate and receives events only for navigation-owned
gestures.

## Public API

```ts
viewport.gestures.setHooks({
  onPointerDown: (context) => PointerGestureClaim,
  onPointerMove: (context) => void,
  onPointerUp: (context) => void,
  onPointerCancel: (context) => void,
});

viewport.gestures.registerGizmo({ hitTest, onPointerMove, onPointerUp, onPointerCancel });
viewport.gestures.registerTool({ hitTest, onPointerMove, onPointerUp, onPointerCancel });
viewport.gestures.setNavigation({ mouseButtons, wheel, touch });
viewport.gestures.cancelActiveGesture("selection-start");
```

## One gesture, one owner

Every pointer ID has exactly one owner for its lifetime:

```ts
type PointerGestureOwner = "selection" | "gizmo" | "tool" | "navigation" | "none";
```

Host `onPointerDown` runs first. If it returns `undefined`, left-mouse
resolution is:

1. Registered gizmo hit test
2. Registered active-tool hit test
3. Selection, when picking is enabled
4. Navigation, only if the configured left button permits it
5. None

Touch never becomes selection. It is `navigation` only when `navigation.touch`
is configured, otherwise `none`.

Default modeling navigation:

| Gesture | Owner / action |
| --- | --- |
| Left click | Selection |
| Left drag | Tool/gizmo only when claimed; otherwise no navigation |
| Right drag | Orbit |
| Middle drag | Pan |
| Wheel | Dolly |
| One-finger touch | None |
| Two-finger touch | None unless explicitly enabled |

## Navigation isolation

A selection event must not reach OrbitControls at all. Do not rely only on
`mouseButtons.LEFT = -1`. Do not make host applications mutate
`OrbitControls.mouseButtons` or private control fields; use
`viewport.gestures.setNavigation`.

## Supported cancellation

```ts
viewport.gestures.cancelActiveGesture("window-blur");
```

Cancellation must call the active owner’s cancellation callback, release
pointer capture, discard pointer ownership, stop forwarding to navigation, and
leave camera position, target, and zoom unchanged. It runs on pointercancel,
lostpointercapture, window blur, canvas removal, viewport disposal, and
explicit host cancellation.

Never make consumers reset private OrbitControls values such as `state`,
`_pointers`, `_pointerPositions`, `_scale`, or `_sphericalDelta`.

## Migration

Replace raw canvas pointer listeners with `gestureHooks` or
`registerGizmo` / `registerTool`. Replace `window` listeners and OrbitControls
private-state resets with `cancelActiveGesture`. Observing canvas events is
safe; claiming ownership through a second listener is not.
