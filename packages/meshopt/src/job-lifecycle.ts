import type { MeshoptJobState } from "./types";

const ALLOWED: Record<MeshoptJobState, readonly MeshoptJobState[]> = {
  queued: ["running", "cancelling", "disposed"],
  running: ["completed", "failed", "cancelling"],
  cancelling: ["failed", "disposed"],
  completed: ["disposed"],
  failed: ["disposed"],
  disposed: [],
};

export class MeshoptJobMachine {
  state: MeshoptJobState = "queued";

  get terminal(): boolean {
    return this.state === "completed" || this.state === "failed" || this.state === "disposed";
  }

  transition(to: MeshoptJobState): boolean {
    if (this.state === to) {
      return true;
    }
    if (!ALLOWED[this.state].includes(to)) {
      return false;
    }
    this.state = to;
    return true;
  }
}
