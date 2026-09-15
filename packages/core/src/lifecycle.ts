export type ResourceLifecycle =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "updating"
  | "suspended"
  | "disposing"
  | "disposed"
  | "failed";

export type OperationLifecycle =
  | "idle"
  | "beginning"
  | "active"
  | "committing"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed";

const RESOURCE_ALLOWED: Record<ResourceLifecycle, readonly ResourceLifecycle[]> = {
  uninitialized: ["initializing", "disposed"],
  initializing: ["ready", "failed", "disposing"],
  ready: ["updating", "suspended", "disposing", "failed"],
  updating: ["ready", "failed", "disposing"],
  suspended: ["ready", "disposing", "failed"],
  failed: ["disposing", "initializing"],
  disposing: ["disposed"],
  disposed: [],
};

const OPERATION_ALLOWED: Record<OperationLifecycle, readonly OperationLifecycle[]> = {
  idle: ["beginning", "failed"],
  beginning: ["active", "failed", "cancelling"],
  active: ["committing", "cancelling", "failed"],
  committing: ["completed", "failed"],
  cancelling: ["cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
};

export class IllegalLifecycleTransitionError extends Error {
  constructor(
    readonly kind: "resource" | "operation",
    readonly from: string,
    readonly to: string,
  ) {
    super(`Illegal ${kind} lifecycle transition: ${from} → ${to}`);
    this.name = "IllegalLifecycleTransitionError";
  }
}

/** Browser-safe NODE_ENV check. Avoids a Node `process` global in host typechecks. */
export function isNonProductionRuntime(): boolean {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  return env !== "production";
}

function rejectOrThrow(
  kind: "resource" | "operation",
  from: string,
  to: string,
): boolean {
  if (isNonProductionRuntime()) {
    throw new IllegalLifecycleTransitionError(kind, from, to);
  }
  return false;
}

export function canTransitionResource(from: ResourceLifecycle, to: ResourceLifecycle): boolean {
  return from === to || RESOURCE_ALLOWED[from].includes(to);
}

export function canTransitionOperation(from: OperationLifecycle, to: OperationLifecycle): boolean {
  return from === to || OPERATION_ALLOWED[from].includes(to);
}

export class ResourceLifecycleMachine implements Disposable {
  state: ResourceLifecycle = "uninitialized";

  get disposed(): boolean {
    return this.state === "disposed";
  }

  get isDisposed(): boolean {
    return this.state === "disposed" || this.state === "disposing";
  }

  get canUpdate(): boolean {
    return this.state === "ready" || this.state === "updating";
  }

  transition(to: ResourceLifecycle): boolean {
    if (this.state === to) {
      return true;
    }
    if (!canTransitionResource(this.state, to)) {
      return rejectOrThrow("resource", this.state, to);
    }
    this.state = to;
    return true;
  }

  dispose(): void {
    if (this.state === "disposed") {
      return;
    }
    if (this.state === "uninitialized") {
      this.state = "disposed";
      return;
    }
    if (canTransitionResource(this.state, "disposing")) {
      this.state = "disposing";
    }
    this.state = "disposed";
  }
}

export class OperationLifecycleMachine {
  state: OperationLifecycle = "idle";

  get isTerminal(): boolean {
    return this.state === "completed" || this.state === "cancelled" || this.state === "failed";
  }

  get canCommit(): boolean {
    return this.state === "active" || this.state === "beginning";
  }

  transition(to: OperationLifecycle): boolean {
    if (this.state === to) {
      return true;
    }
    if (!canTransitionOperation(this.state, to)) {
      return rejectOrThrow("operation", this.state, to);
    }
    this.state = to;
    return true;
  }

  fail(): void {
    if (this.isTerminal) {
      return;
    }
    this.state = "failed";
  }

  /**
   * Return to `idle` so a long-lived tool can start another gesture.
   * Open gestures are cancelled; one-shot machines (e.g. TransformGesture) should not call this.
   */
  recycle(): void {
    if (this.state === "idle") {
      return;
    }
    if (!this.isTerminal) {
      if (this.state === "beginning" || this.state === "active") {
        this.transition("cancelling");
        this.transition("cancelled");
      } else if (this.state === "committing") {
        this.transition("failed");
      } else if (this.state === "cancelling") {
        this.transition("cancelled");
      }
    }
    this.state = "idle";
  }
}

export interface Disposable {
  readonly disposed: boolean;
  dispose(): void;
}
