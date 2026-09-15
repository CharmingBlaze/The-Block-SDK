import { OperationLifecycleMachine, type OperationLifecycle } from "@modeling-kit/core";

/**
 * Shared idle → beginning → active → commit/cancel session for modal modeling tools.
 * Preview lives on the tool; kernel mutation happens only through commands on commit.
 */
export class ModalToolSession {
  readonly lifecycle = new OperationLifecycleMachine();

  get state(): OperationLifecycle {
    return this.lifecycle.state;
  }

  get active(): boolean {
    return this.state === "beginning" || this.state === "active";
  }

  begin(): void {
    this.lifecycle.recycle();
    this.lifecycle.transition("beginning");
  }

  /** First pointer/numeric drag after activate. */
  markActive(): void {
    if (this.state === "beginning") {
      this.lifecycle.transition("active");
    }
  }

  /**
   * Finish a successful preview. Returns false if the machine was not open
   * (already cancelled/completed). Recycles to idle for the next stroke.
   */
  commit(): boolean {
    if (this.lifecycle.isTerminal || this.state === "idle") {
      return false;
    }
    if (this.state === "beginning") {
      this.lifecycle.transition("active");
    }
    this.lifecycle.transition("committing");
    this.lifecycle.transition("completed");
    this.lifecycle.recycle();
    return true;
  }

  cancel(): void {
    this.lifecycle.recycle();
  }

  dispose(): void {
    this.cancel();
  }
}
