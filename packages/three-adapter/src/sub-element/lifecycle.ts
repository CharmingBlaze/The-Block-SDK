import { isNonProductionRuntime } from "@modeling-kit/core";

export type MeshVisualLifecycle =
  | "uninitialized"
  | "building"
  | "ready"
  | "updating"
  | "suspended"
  | "disposing"
  | "disposed"
  | "failed";

const ALLOWED: Record<MeshVisualLifecycle, readonly MeshVisualLifecycle[]> = {
  uninitialized: ["building"],
  building: ["ready", "failed"],
  ready: ["updating", "suspended", "disposing"],
  updating: ["ready", "failed"],
  suspended: ["ready", "disposing"],
    failed: ["disposing", "building"],
  disposing: ["disposed"],
  disposed: [],
};

export class IllegalLifecycleTransitionError extends Error {
  constructor(
    readonly from: MeshVisualLifecycle,
    readonly to: MeshVisualLifecycle,
  ) {
    super(`Illegal mesh visual lifecycle transition: ${from} → ${to}`);
    this.name = "IllegalLifecycleTransitionError";
  }
}

export function canTransitionLifecycle(
  from: MeshVisualLifecycle,
  to: MeshVisualLifecycle,
): boolean {
  return ALLOWED[from].includes(to);
}

export class MeshVisualLifecycleMachine {
  state: MeshVisualLifecycle = "uninitialized";

  get isAlive(): boolean {
    return this.state !== "disposed" && this.state !== "disposing";
  }

  get canUpdate(): boolean {
    return this.state === "ready" || this.state === "updating";
  }

  transition(to: MeshVisualLifecycle): boolean {
    if (this.state === to) {
      return true;
    }
    if (!canTransitionLifecycle(this.state, to)) {
      if (isNonProductionRuntime()) {
        throw new IllegalLifecycleTransitionError(this.state, to);
      }
      return false;
    }
    this.state = to;
    return true;
  }

  dispose(): void {
    if (this.state === "disposed" || this.state === "disposing") {
      this.state = "disposed";
      return;
    }
    if (this.state === "uninitialized") {
      this.state = "disposed";
      return;
    }
    if (this.state === "building" || this.state === "updating") {
      this.state = "failed";
    }
    if (canTransitionLifecycle(this.state, "disposing")) {
      this.state = "disposing";
    }
    this.state = "disposed";
  }
}
