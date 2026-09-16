import { MeshoptJobMachine } from "./job-lifecycle";
import type { MeshoptJobResult, MeshoptJobState } from "./types";

export class MeshoptJob {
  readonly lifecycle = new MeshoptJobMachine();
  readonly id: string;
  private settle: ((result: MeshoptJobResult) => void) | undefined;
  private outcome: MeshoptJobResult | undefined;
  readonly done: Promise<MeshoptJobResult>;

  constructor(id: string) {
    this.id = id;
    this.done = new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  get state(): MeshoptJobState {
    return this.lifecycle.state;
  }

  cancel(): void {
    if (this.lifecycle.terminal) {
      return;
    }
    this.lifecycle.transition("cancelling");
  }

  get cancelled(): boolean {
    return this.state === "cancelling" || this.state === "disposed";
  }

  complete(result: MeshoptJobResult): void {
    if (this.lifecycle.terminal) {
      return;
    }
    this.outcome = result;
    this.lifecycle.transition(result.ok ? "completed" : "failed");
    this.settle?.(result);
    this.settle = undefined;
  }

  dispose(): void {
    if (this.state !== "disposed") {
      if (!this.lifecycle.terminal) {
        this.lifecycle.transition("cancelling");
        this.complete({ ok: false, error: "disposed", code: "disposed" });
      }
      this.lifecycle.transition("disposed");
    }
    this.outcome = undefined;
  }
}
