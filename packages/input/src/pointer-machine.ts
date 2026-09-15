import type {
  ActionId,
  GestureFrame,
  InputModifiers,
  KeymapEntry,
  PointerBinding,
  PointerPacket,
} from "./types";
import { contextsAllowBinding } from "./keymap";
import type { InputContext } from "./types";

export interface PointerTrack {
  readonly action: ActionId;
  readonly mode: "tap" | "drag";
  readonly start: PointerPacket;
  readonly current: PointerPacket;
  readonly begun: boolean;
}

export interface PointerMachineConfig {
  readonly slopPx: number;
  readonly keymap: readonly KeymapEntry[];
  contexts: () => readonly InputContext[];
}

export type PointerStep =
  | { readonly type: "none" }
  | { readonly type: "tap"; readonly action: ActionId; readonly packet: PointerPacket }
  | { readonly type: "gesture-begin"; readonly frame: GestureFrame }
  | { readonly type: "gesture-update"; readonly frame: GestureFrame }
  | { readonly type: "gesture-commit"; readonly frame: GestureFrame }
  | { readonly type: "gesture-cancel"; readonly frame: GestureFrame };

export class PointerMachine {
  private readonly tracks = new Map<number, PointerTrack>();

  constructor(private readonly config: PointerMachineConfig) {}

  get tracking(): boolean {
    return this.tracks.size > 0;
  }

  get active(): boolean {
    for (const track of this.tracks.values()) {
      if (track.begun) {
        return true;
      }
    }
    return false;
  }

  step(packet: PointerPacket): PointerStep {
    if (packet.kind === "pointerdown") {
      return this.onDown(packet);
    }
    if (packet.kind === "pointermove") {
      return this.onMove(packet);
    }
    if (packet.kind === "pointerup") {
      return this.onUp(packet);
    }
    return this.onCancel(packet);
  }

  cancelPointer(pointerId: number, packet: PointerPacket): PointerStep {
    const track = this.tracks.get(pointerId);
    this.tracks.delete(pointerId);
    if (track?.begun) {
      return { type: "gesture-cancel", frame: toFrame(track.action, track.start, packet) };
    }
    return { type: "none" };
  }

  cancelAll(packet: PointerPacket): PointerStep[] {
    const steps: PointerStep[] = [];
    for (const pointerId of [...this.tracks.keys()]) {
      steps.push(this.cancelPointer(pointerId, packet));
    }
    return steps;
  }

  private onDown(packet: PointerPacket): PointerStep {
    const drag = this.matchPointer(packet, "drag");
    const tap = this.matchPointer(packet, "tap");
    if (drag) {
      this.tracks.set(packet.pointerId, {
        action: drag,
        mode: "drag",
        start: packet,
        current: packet,
        begun: false,
      });
      return { type: "none" };
    }
    if (tap) {
      this.tracks.set(packet.pointerId, {
        action: tap,
        mode: "tap",
        start: packet,
        current: packet,
        begun: false,
      });
    }
    return { type: "none" };
  }

  private onMove(packet: PointerPacket): PointerStep {
    const track = this.tracks.get(packet.pointerId);
    if (!track) {
      return { type: "none" };
    }
    const next: PointerTrack = { ...track, current: packet };
    const dist = distance(track.start.canvas, packet.canvas);
    if (track.mode === "drag" && !track.begun && dist >= this.config.slopPx) {
      const begun = { ...next, begun: true };
      this.tracks.set(packet.pointerId, begun);
      return { type: "gesture-begin", frame: toFrame(begun.action, begun.start, packet) };
    }
    if (track.begun) {
      this.tracks.set(packet.pointerId, next);
      return { type: "gesture-update", frame: toFrame(next.action, next.start, packet) };
    }
    this.tracks.set(packet.pointerId, next);
    return { type: "none" };
  }

  private onUp(packet: PointerPacket): PointerStep {
    const track = this.tracks.get(packet.pointerId);
    this.tracks.delete(packet.pointerId);
    if (!track) {
      return { type: "none" };
    }
    if (track.begun) {
      return { type: "gesture-commit", frame: toFrame(track.action, track.start, packet) };
    }
    if (track.mode === "drag") {
      const tap = this.matchPointer(track.start, "tap");
      if (tap) {
        return { type: "tap", action: tap, packet: track.start };
      }
      return { type: "none" };
    }
    return { type: "tap", action: track.action, packet: track.start };
  }

  private onCancel(packet: PointerPacket): PointerStep {
    return this.cancelPointer(packet.pointerId, packet);
  }

  private matchPointer(packet: PointerPacket, when: "tap" | "drag"): ActionId | undefined {
    const stack = this.config.contexts();
    let best: { action: ActionId; score: number } | undefined;
    for (const entry of this.config.keymap) {
      if (!contextsAllowBinding(stack, entry) || !entry.pointers) {
        continue;
      }
      for (const binding of entry.pointers) {
        if (!pointerMatches(binding, packet, when)) {
          continue;
        }
        const score = modifierScore(binding.modifiers);
        if (!best || score > best.score) {
          best = { action: entry.action, score };
        }
      }
    }
    return best?.action;
  }
}

function pointerMatches(binding: PointerBinding, packet: PointerPacket, when: "tap" | "drag"): boolean {
  if (binding.when !== when) {
    return false;
  }
  if (binding.kind && binding.kind !== "any" && binding.kind !== packet.pointerKind) {
    return false;
  }
  if (binding.button && binding.button !== packet.button) {
    return false;
  }
  return modifiersMatch(packet.modifiers, binding.modifiers);
}

function modifiersMatch(actual: InputModifiers, required?: Partial<InputModifiers>): boolean {
  if (!required) {
    return true;
  }
  if (required.alt !== undefined && required.alt !== actual.alt) {
    return false;
  }
  if (required.ctrl !== undefined && required.ctrl !== actual.ctrl) {
    return false;
  }
  if (required.meta !== undefined && required.meta !== actual.meta) {
    return false;
  }
  if (required.shift !== undefined && required.shift !== actual.shift) {
    return false;
  }
  return true;
}

function modifierScore(required?: Partial<InputModifiers>): number {
  if (!required) {
    return 0;
  }
  return Object.values(required).filter((value) => value !== undefined).length;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function toFrame(action: ActionId, start: PointerPacket, current: PointerPacket): GestureFrame {
  return {
    action,
    pointerId: current.pointerId,
    pointerKind: current.pointerKind,
    startCanvas: start.canvas,
    startNdc: start.ndc,
    canvas: current.canvas,
    ndc: current.ndc,
    deltaCanvas: { x: current.canvas.x - start.canvas.x, y: current.canvas.y - start.canvas.y },
    deltaNdc: { x: current.ndc.x - start.ndc.x, y: current.ndc.y - start.ndc.y },
    pressure: current.pressure,
    modifiers: current.modifiers,
  };
}
