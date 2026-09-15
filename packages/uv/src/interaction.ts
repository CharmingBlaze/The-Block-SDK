import { IllegalLifecycleTransitionError, isNonProductionRuntime } from "@modeling-kit/core";

export type UVInteractionState =
  | "idle"
  | "hovering"
  | "pressed"
  | "box-selecting"
  | "lasso-selecting"
  | "transforming"
  | "previewing-operation"
  | "committing"
  | "cancelling"
  | "failed";

const ALLOWED: Record<UVInteractionState, readonly UVInteractionState[]> = {
  idle: ["hovering", "pressed", "transforming", "box-selecting", "lasso-selecting", "previewing-operation", "failed"],
  hovering: ["idle", "pressed", "failed"],
  pressed: ["idle", "hovering", "transforming", "box-selecting", "lasso-selecting", "cancelling", "failed"],
  "box-selecting": ["committing", "cancelling", "failed"],
  "lasso-selecting": ["committing", "cancelling", "failed"],
  transforming: ["committing", "cancelling", "failed"],
  "previewing-operation": ["committing", "cancelling", "transforming", "failed"],
  committing: ["idle", "failed"],
  cancelling: ["idle", "failed"],
  failed: ["idle"],
};

export function canTransitionUvInteraction(from: UVInteractionState, to: UVInteractionState): boolean {
  return from === to || ALLOWED[from].includes(to);
}

/**
 * Pointer/tool machine for the UV editor. Transform commit/cancel uses
 * `OperationLifecycleMachine` on `UvTransformSession`; this machine only
 * tracks hover, press, marquee, and lasso.
 */
export class UVInteractionMachine {
  state: UVInteractionState = "idle";

  can(to: UVInteractionState): boolean {
    return canTransitionUvInteraction(this.state, to);
  }

  transition(to: UVInteractionState): boolean {
    if (this.state === to) {
      return true;
    }
    if (!this.can(to)) {
      if (isNonProductionRuntime()) {
        throw new IllegalLifecycleTransitionError("operation", this.state, to);
      }
      return false;
    }
    this.state = to;
    return true;
  }

  fail(): void {
    this.state = "failed";
  }

  reset(): void {
    this.state = "idle";
  }
}
