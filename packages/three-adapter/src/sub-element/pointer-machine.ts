export type ElementInteractionState =
  | "idle"
  | "hovering"
  | "pressed"
  | "dragging"
  | "committing"
  | "cancelling";

export type PointerPhase = ElementInteractionState | "committed" | "cancelled";

export type InteractionCancelReason =
  | "escape"
  | "pointercancel"
  | "lostcapture"
  | "tool-change"
  | "viewport-change"
  | "document-close"
  | "deleted"
  | "adapter-dispose"
  | "transaction-failed";

export interface PointerTarget {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly elementId: string | null;
}

export interface PointerMachineConfig {
  readonly dragSlopPx?: number;
  readonly onRestore?: () => void;
  readonly onReleaseCapture?: () => void;
}

export class ElementPointerMachine {
  phase: PointerPhase = "idle";
  hoverId: string | null = null;
  pressedId: string | null = null;
  pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly dragSlopPx: number;
  private readonly onRestore: (() => void) | undefined;
  private readonly onReleaseCapture: (() => void) | undefined;

  constructor(config: PointerMachineConfig = {}) {
    this.dragSlopPx = config.dragSlopPx ?? 4;
    this.onRestore = config.onRestore;
    this.onReleaseCapture = config.onReleaseCapture;
  }

  get interactionState(): ElementInteractionState {
    if (this.phase === "committed") {
      return "idle";
    }
    if (this.phase === "cancelled") {
      return "idle";
    }
    return this.phase;
  }

  hover(target: PointerTarget | null): PointerPhase {
    if (this.phase === "pressed" || this.phase === "dragging" || this.phase === "committing") {
      return this.phase;
    }
    if (!target || target.elementId === null) {
      this.hoverId = null;
      this.phase = "idle";
      return this.phase;
    }
    this.hoverId = target.elementId;
    this.phase = "hovering";
    return this.phase;
  }

  press(target: PointerTarget): PointerPhase {
    this.pointerId = target.pointerId;
    this.originX = target.x;
    this.originY = target.y;
    this.pressedId = target.elementId;
    this.hoverId = target.elementId;
    this.phase = "pressed";
    return this.phase;
  }

  move(target: PointerTarget): PointerPhase {
    if (this.phase === "pressed" || this.phase === "dragging") {
      if (this.pointerId !== null && target.pointerId !== this.pointerId) {
        return this.phase;
      }
      const dist = Math.hypot(target.x - this.originX, target.y - this.originY);
      if (dist > this.dragSlopPx) {
        this.phase = "dragging";
      }
      return this.phase;
    }
    return this.hover(target);
  }

  commit(): PointerPhase {
    if (this.phase !== "pressed" && this.phase !== "dragging") {
      return this.phase;
    }
    this.phase = "committing";
    this.pointerId = null;
    this.pressedId = null;
    this.onReleaseCapture?.();
    this.phase = this.hoverId ? "hovering" : "idle";
    return "committed";
  }

  cancel(reason: InteractionCancelReason = "pointercancel"): PointerPhase {
    if (this.phase === "idle" && !this.pressedId) {
      return this.phase;
    }
    this.phase = "cancelling";
    this.onRestore?.();
    this.onReleaseCapture?.();
    this.pointerId = null;
    this.pressedId = null;
    void reason;
    this.phase = this.hoverId ? "hovering" : "idle";
    return "cancelled";
  }

  lostCapture(): PointerPhase {
    return this.cancel("lostcapture");
  }

  pruneDeleted(live: ReadonlySet<string>): void {
    if (this.hoverId && !live.has(this.hoverId)) {
      this.hoverId = null;
    }
    if (this.pressedId && !live.has(this.pressedId)) {
      this.cancel("deleted");
    }
    if (!this.hoverId && (this.phase === "hovering" || this.phase === "idle")) {
      this.phase = "idle";
    }
  }

  reset(): void {
    this.phase = "idle";
    this.hoverId = null;
    this.pressedId = null;
    this.pointerId = null;
  }
}
