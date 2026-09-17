import { assertFinite } from "@modeling-kit/math";
import { contextsAllowBinding, defaultAxisBindings, defaultModelingKeymap } from "./keymap";
import { PointerMachine } from "./pointer-machine";
import type {
  ActionContext,
  ActionId,
  AxisKeyBinding,
  ButtonState,
  DispatchResult,
  GestureFrame,
  GestureHandlers,
  InputAxes,
  InputContext,
  InputModifiers,
  InputPacket,
  KeymapEntry,
  KeyPacket,
  PointerPacket,
  WheelPacket,
} from "./types";
import { emptyAxes } from "./types";
import { pointerPacket } from "./packets";

export interface InputEngineOptions {
  readonly keymap?: readonly KeymapEntry[];
  readonly axes?: readonly AxisKeyBinding[];
  readonly slopPx?: number;
  readonly pixelsPerMm?: number;
}

type ActionHandler = (context: ActionContext) => void;

export class InputEngine {
  private readonly keymap: readonly KeymapEntry[];
  private readonly axisBindings: readonly AxisKeyBinding[];
  private readonly actionHandlers = new Map<ActionId, Set<ActionHandler>>();
  private readonly gestureHandlers = new Map<ActionId, Set<GestureHandlers>>();
  private readonly held = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly releasedThisFrame = new Set<string>();
  private readonly heldButtons = new Set<string>();
  private readonly pressedButtons = new Set<string>();
  private readonly releasedButtons = new Set<string>();
  private contextStack: InputContext[] = ["app", "viewport.model"];
  private wheelZoom = 0;
  private framePointerDelta = { x: 0, y: 0 };
  private lastPressure = 0;
  private penActive = false;
  private lastCanvas: { x: number; y: number } | null = null;
  private readonly pointers: PointerMachine;
  private disposed = false;

  constructor(options: InputEngineOptions = {}) {
    this.keymap = options.keymap ?? defaultModelingKeymap;
    this.axisBindings = options.axes ?? defaultAxisBindings;
    const mm = options.pixelsPerMm ?? 96 / 25.4;
    const slopPx = options.slopPx ?? Math.max(4, 1.5 * mm);
    this.pointers = new PointerMachine({
      slopPx,
      keymap: this.keymap,
      contexts: () => this.contextStack,
    });
  }

  get contexts(): readonly InputContext[] {
    return this.contextStack;
  }

  get isGesturing(): boolean {
    return this.pointers.active;
  }

  get isTracking(): boolean {
    return this.pointers.tracking;
  }

  pushContext(context: InputContext): void {
    this.contextStack = [...this.contextStack, context];
  }

  popContext(context?: InputContext): void {
    if (context === undefined) {
      if (this.contextStack.length > 2) {
        this.contextStack = this.contextStack.slice(0, -1);
      }
      return;
    }
    const index = this.contextStack.lastIndexOf(context);
    if (index >= 0) {
      this.contextStack = this.contextStack.filter((_, i) => i !== index);
    }
  }

  onAction(action: ActionId, handler: ActionHandler): () => void {
    let set = this.actionHandlers.get(action);
    if (!set) {
      set = new Set();
      this.actionHandlers.set(action, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  onGesture(action: ActionId, handlers: GestureHandlers): () => void {
    let set = this.gestureHandlers.get(action);
    if (!set) {
      set = new Set();
      this.gestureHandlers.set(action, set);
    }
    set.add(handlers);
    return () => {
      set.delete(handlers);
    };
  }

  dispatch(packet: InputPacket): DispatchResult {
    if (this.disposed) {
      throw new RangeError("InputEngine is disposed");
    }
    if (packet.kind === "keydown" || packet.kind === "keyup") {
      return this.dispatchKey(packet);
    }
    if (packet.kind === "wheel") {
      return this.dispatchWheel(packet);
    }
    if (
      packet.kind === "pointerdown" ||
      packet.kind === "pointermove" ||
      packet.kind === "pointerup" ||
      packet.kind === "pointercancel"
    ) {
      return this.dispatchPointer(packet);
    }
    return { consumed: false };
  }

  axes(): InputAxes {
    const move = { x: 0, y: 0, z: 0 };
    for (const binding of this.axisBindings) {
      const positive = binding.positive && this.held.has(binding.positive) ? 1 : 0;
      const negative = binding.negative && this.held.has(binding.negative) ? 1 : 0;
      const value = positive - negative;
      if (binding.axis === "nav.right" || binding.axis === "moveX") {
        move.x += value;
      } else if (binding.axis === "nav.up" || binding.axis === "moveY") {
        move.y += value;
      } else if (binding.axis === "nav.forward" || binding.axis === "moveZ") {
        move.z += value;
      }
    }
    return {
      ...emptyAxes(),
      moveX: move.x,
      moveY: move.y,
      moveZ: move.z,
      orbitX: this.framePointerDelta.x,
      orbitY: this.framePointerDelta.y,
      panX: this.framePointerDelta.x,
      panY: this.framePointerDelta.y,
      zoom: this.wheelZoom,
      pressure: this.penActive || this.pointers.tracking ? this.lastPressure : 0,
    };
  }

  key(code: string): ButtonState {
    return {
      down: this.held.has(code),
      pressedThisFrame: this.pressedThisFrame.has(code),
      releasedThisFrame: this.releasedThisFrame.has(code),
    };
  }

  pointerButton(button: string): ButtonState {
    return {
      down: this.heldButtons.has(button),
      pressedThisFrame: this.pressedButtons.has(button),
      releasedThisFrame: this.releasedButtons.has(button),
    };
  }

  endFrame(): void {
    this.wheelZoom = 0;
    this.framePointerDelta = { x: 0, y: 0 };
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.pressedButtons.clear();
    this.releasedButtons.clear();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const cancel = pointerPacket({ kind: "pointercancel", buttons: 0 });
    for (const step of this.pointers.cancelAll(cancel)) {
      if (step.type === "gesture-cancel") {
        this.emitGesture("cancel", step.frame);
      }
    }
    this.actionHandlers.clear();
    this.gestureHandlers.clear();
    this.held.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.heldButtons.clear();
    this.pressedButtons.clear();
    this.releasedButtons.clear();
    this.lastCanvas = null;
    this.contextStack = ["app"];
  }

  private dispatchKey(packet: KeyPacket): DispatchResult {
    if (this.contextStack.includes("focus.text")) {
      return { consumed: false, capturePointer: false };
    }
    if (packet.kind === "keydown") {
      if (!packet.repeat && !this.held.has(packet.code)) {
        this.pressedThisFrame.add(packet.code);
      }
      this.held.add(packet.code);
    } else {
      this.held.delete(packet.code);
      this.releasedThisFrame.add(packet.code);
    }
    if (packet.kind !== "keydown") {
      return { consumed: false };
    }
    if (this.pointers.active && packet.code !== "Escape") {
      return { consumed: true };
    }
    const action = this.matchChord(packet);
    if (!action) {
      return { consumed: false };
    }
    if (action === "tool.cancel") {
      this.cancelGestures(packet);
    }
    this.emitAction(action, packet);
    return { consumed: true, action };
  }

  private dispatchWheel(packet: WheelPacket): DispatchResult {
    this.wheelZoom += packet.deltaY;
    return { consumed: false };
  }

  private dispatchPointer(packet: PointerPacket): DispatchResult {
    assertFinite(packet.canvas.x, "canvas.x");
    assertFinite(packet.canvas.y, "canvas.y");
    assertFinite(packet.ndc.x, "ndc.x");
    assertFinite(packet.ndc.y, "ndc.y");
    this.lastPressure = packet.pressure;
    if (packet.pointerKind === "pen") {
      this.penActive = packet.kind !== "pointerup" && packet.kind !== "pointercancel";
    } else if (packet.kind === "pointerup" || packet.kind === "pointercancel") {
      this.penActive = false;
    }
    if (packet.kind === "pointermove" && this.lastCanvas) {
      this.framePointerDelta.x += packet.canvas.x - this.lastCanvas.x;
      this.framePointerDelta.y += packet.canvas.y - this.lastCanvas.y;
    }
    if (packet.kind === "pointerdown" || packet.kind === "pointermove") {
      this.lastCanvas = { x: packet.canvas.x, y: packet.canvas.y };
    }
    if (packet.kind === "pointerup" || packet.kind === "pointercancel") {
      this.lastCanvas = null;
    }
    if (packet.kind === "pointerdown" && packet.button) {
      this.heldButtons.add(packet.button);
      this.pressedButtons.add(packet.button);
    }
    if ((packet.kind === "pointerup" || packet.kind === "pointercancel") && packet.button) {
      this.heldButtons.delete(packet.button);
      this.releasedButtons.add(packet.button);
    }
    const step = this.pointers.step(packet);
    switch (step.type) {
      case "none":
        return {
          consumed: this.pointers.tracking,
          capturePointer: false,
          preventDefault: this.pointers.tracking,
        };
      case "tap":
        this.emitAction(step.action, step.packet);
        return { consumed: true, capturePointer: false, preventDefault: true, action: step.action };
      case "gesture-begin":
        this.pushContext("modal.transform");
        this.emitGesture("begin", step.frame);
        this.emitGesture("update", step.frame);
        return { consumed: true, capturePointer: true, preventDefault: true, action: step.frame.action };
      case "gesture-update":
        this.emitGesture("update", step.frame);
        return { consumed: true, capturePointer: false, preventDefault: true, action: step.frame.action };
      case "gesture-commit":
        this.emitGesture("commit", step.frame);
        this.popContext("modal.transform");
        return { consumed: true, capturePointer: false, preventDefault: true, action: step.frame.action };
      case "gesture-cancel":
        this.emitGesture("cancel", step.frame);
        this.popContext("modal.transform");
        return { consumed: true, capturePointer: false, preventDefault: true, action: step.frame.action };
    }
  }

  private cancelGestures(packet: KeyPacket): void {
    const fake: PointerPacket = {
      kind: "pointercancel",
      time: packet.time,
      pointerId: -1,
      pointerKind: "mouse",
      isPrimary: true,
      button: null,
      buttons: 0,
      canvas: { x: 0, y: 0 },
      ndc: { x: 0, y: 0 },
      pressure: 0,
      tilt: { x: 0, y: 0 },
      twist: 0,
      modifiers: packet.modifiers,
    };
    for (const step of this.pointers.cancelAll(fake)) {
      if (step.type === "gesture-cancel") {
        this.emitGesture("cancel", step.frame);
        this.popContext("modal.transform");
      }
    }
  }

  private matchChord(packet: KeyPacket): ActionId | undefined {
    for (const entry of this.keymap) {
      if (!contextsAllowBinding(this.contextStack, entry) || !entry.chords) {
        continue;
      }
      for (const chord of entry.chords) {
        if (packet.repeat && !chord.repeat) {
          continue;
        }
        if (chordMatches(chord.keys, packet.code, packet.modifiers)) {
          return entry.action;
        }
      }
    }
    return undefined;
  }

  private emitAction(action: ActionId, packet: InputPacket): void {
    const handlers = this.actionHandlers.get(action);
    if (!handlers) {
      return;
    }
    const context: ActionContext = {
      action,
      packet,
      ...("ndc" in packet ? { ndc: packet.ndc, canvas: packet.canvas } : {}),
    };
    for (const handler of handlers) {
      handler(context);
    }
  }

  private emitGesture(phase: keyof GestureHandlers, frame: GestureFrame): void {
    const handlers = this.gestureHandlers.get(frame.action);
    if (!handlers) {
      return;
    }
    for (const set of handlers) {
      set[phase](frame);
    }
  }
}

export function createInputEngine(options: InputEngineOptions = {}): InputEngine {
  return new InputEngine(options);
}

function chordMatches(keys: readonly string[], code: string, modifiers: InputModifiers): boolean {
  const needed = new Set(keys);
  const trigger = [...needed].find((key) => !isModifierToken(key));
  if (trigger !== undefined) {
    if (trigger !== code) {
      return false;
    }
    needed.delete(trigger);
  } else if (![...needed].includes(code) && code !== "Escape") {
    return false;
  }
  const wantShift = needed.has("Shift");
  const wantAlt = needed.has("Alt");
  if (needed.has("Control") && !modifiers.ctrl) {
    return false;
  }
  if (needed.has("Meta") && !modifiers.meta) {
    return false;
  }
  if (needed.has("ControlOrMeta") && !(modifiers.ctrl || modifiers.meta)) {
    return false;
  }
  if (wantShift !== modifiers.shift) {
    return false;
  }
  if (wantAlt !== modifiers.alt) {
    return false;
  }
  if (!needed.has("Control") && !needed.has("ControlOrMeta") && modifiers.ctrl) {
    return false;
  }
  if (!needed.has("Meta") && !needed.has("ControlOrMeta") && modifiers.meta) {
    return false;
  }
  return true;
}

function isModifierToken(token: string): boolean {
  return (
    token === "Control" ||
    token === "Shift" ||
    token === "Alt" ||
    token === "Meta" ||
    token === "ControlOrMeta"
  );
}
