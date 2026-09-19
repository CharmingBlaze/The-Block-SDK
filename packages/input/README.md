# @modeling-kit/input

**Headless input engine with configurable keymap.** Normalizes keyboard, pointer, and wheel events into typed action packets — framework-agnostic, no DOM dependency.

## Purpose

The `input` package decouples user input from rendering:

- **InputEngine** — headless event processor that normalizes raw events into `GestureFrame` batches
- **Keymap** — configurable key-to-action bindings with chord support (e.g., `Shift+G` = "grab")
- **Context system** — `ActionContext` routes inputs to the currently active tool or viewport mode
- **Pointer machine** — state machine tracking pointer button phases (idle → start → drag → end)
- **DOM adapter** — optional `@modeling-kit/input/dom` provides browser event binding

## Key Exports

```ts
import {
  createInputEngine, InputEngine,
  type InputEngineOptions,
} from "@modeling-kit/input";

// Keymap
import {
  contextsAllowBinding, defaultAxisBindings, defaultModelingKeymap,
  lastExclusive,
} from "@modeling-kit/input";

// Packets
import {
  keyPacket, pointerPacket, wheelPacket,
} from "@modeling-kit/input";

// Types
import type {
  ActionContext, ActionId,
  AxisKeyBinding, ButtonState, ChordBinding,
  DispatchResult, GestureFrame, GestureHandlers,
  InputAxes, InputContext, InputModifiers,
  InputPacket, InputVec2, KeymapEntry, KeyPacket,
  PointerBinding, PointerButton, PointerKind,
  PointerPacket, WheelPacket,
} from "@modeling-kit/input";

// DOM adapter (optional)
import { createDomInputEngine } from "@modeling-kit/input/dom";
```

## Usage Example

```ts
import { createInputEngine } from "@modeling-kit/input";

const engine = createInputEngine({
  keymap: [
    { action: "grab", keys: ["KeyG"], ctx: "modeling" },
    { action: "rotate", keys: ["KeyR"], ctx: "modeling" },
    { action: "scale", keys: ["KeyS"], ctx: "modeling" },
    { action: "delete", keys: ["Delete"], ctx: "modeling" },
    { action: "undo", keys: ["KeyZ"], mods: ["ctrl"], ctx: "modeling" },
  ],
  context: "modeling",
});

// Feed events (from any source)
engine.handleKey("keydown", "KeyG", { ctrl: false, shift: false, alt: false });
engine.handlePointer("pointerdown", { x: 100, y: 200 }, { button: 0 });
engine.handlePointer("pointermove", { x: 110, y: 205 }, { button: 0 });
engine.handlePointer("pointerup", { x: 110, y: 205 }, { button: 0 });

// Process a frame
const frame = engine.tick();
console.log(frame.actions);  // [{ action: "grab", state: "started" }]
console.log(frame.pointers);  // [{ phase: "drag", delta: { x: 10, y: 5 } }]
```

```ts
// DOM adapter (browser only)
import { createDomInputEngine } from "@modeling-kit/input/dom";

const engine = createDomInputEngine({
  element: document.getElementById("viewport")!,
  keymap: defaultModelingKeymap,
});
// Automatically binds keyboard, pointer, and wheel events
```

## Architecture Notes

- `InputEngine` has **zero DOM dependencies** — it accepts raw event data and can be driven by headless tests, gamepads, or custom renderers.
- Key bindings support **modifiers** (Ctrl, Shift, Alt), **chords** (multi-key combinations), and **exclusive contexts**.
- The **pointer machine** tracks `phase` transitions (idle → start → drag → end) for drag gestures.
- `GestureFrame` provides a complete snapshot of all input state for one frame — this is consumed by `@modeling-kit/three-adapter`'s viewport controller and tool system.
- The optional `dom` entry point binds browser events automatically and handles `preventDefault`, `pointerCapture`, and focus management.
- See `docs/architecture/input.md` for the full keymap schema and context routing rules.