# Input engine

**Package:** `@modeling-kit/input`  
**DOM binder:** `@modeling-kit/input/dom`

Hosts send normalized packets (or `bindDom` on a canvas). The engine resolves **actions**, **gestures**, and **axes**. It does not pick, mutate the document, or import Three.js.

```
Host canvas  →  bindDom  →  InputEngine.dispatch(packet)
                                ├─ onAction("edit.undo" | "select.pick" | …)
                                ├─ onGesture("transform.slide") begin/update/commit/cancel
                                └─ axes() once per frame, then endFrame()
Host tool code  →  ModelingSession / ThreeViewportAdapter.pick
```

## API

- `createInputEngine({ keymap, axes, slopPx, pixelsPerMm })`
- `pushContext` / `popContext` — stack starts as `app`, `viewport.model`. Exclusive tops: `focus.text`, `modal.transform`.
- Shortcuts use physical `code` (`KeyZ`), not `key`.
- Pointer tap vs drag: movement past slop starts a gesture; Escape / `pointercancel` / lost capture cancel with **no** commit.
- `axes()` returns the current `InputAxes` snapshot (`moveX/Y/Z`, `orbitX/Y`, `panX/Y`, `zoom`, `pressure`). **Read it before `endFrame()`.**
- `endFrame()` clears wheel, pointer deltas, and pressed/released flags. Held keys, held buttons, active pointers, and pen pressure (while the pen is active) remain.
- `dispatch()` sets `capturePointer` only when a **drag gesture begins** (not on select-click down). `bindDom` captures then, and always `releasePointerCapture` on up/cancel.
- Do not wire `bindDom` into `createThreeViewport`. Viewport picking is a separate left-click path.

Do not bind tools to raw `event.button`. Camera orbit may stay on the host (e.g. OrbitControls) in v1; do not put keymaps in `three-adapter`. Ownership of document vs session vs adapter is in `docs/architecture/ownership.md`. Custom picking: [`../guides/custom-host-picking.md`](../guides/custom-host-picking.md).
