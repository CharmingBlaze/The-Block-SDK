import { describe, expect, it } from "vitest";
import {
  DirtyBatcher,
  IllegalLifecycleTransitionError,
  ObjectUrlRegistry,
  OperationLifecycleMachine,
  ResourceDiagnosticsTracker,
  ResourceLifecycleMachine,
  SDKDirtyFlag,
  isStaleJobResult,
} from "../src/index";

describe("core lifecycle and dirty batching", () => {
  it("rejects illegal resource and operation transitions", () => {
    const resource = new ResourceLifecycleMachine();
    expect(resource.transition("initializing")).toBe(true);
    expect(resource.transition("ready")).toBe(true);
    expect(() => resource.transition("uninitialized")).toThrow(IllegalLifecycleTransitionError);
    resource.dispose();
    resource.dispose();
    expect(resource.disposed).toBe(true);
    expect(resource.canUpdate).toBe(false);

    const op = new OperationLifecycleMachine();
    op.transition("beginning");
    op.transition("active");
    op.transition("cancelling");
    op.transition("cancelled");
    expect(() => op.transition("committing")).toThrow(IllegalLifecycleTransitionError);

    const reusable = new OperationLifecycleMachine();
    reusable.transition("beginning");
    reusable.recycle();
    expect(reusable.state).toBe("idle");
    reusable.transition("beginning");
    reusable.transition("active");
    reusable.transition("committing");
    reusable.transition("completed");
    reusable.recycle();
    expect(reusable.state).toBe("idle");
  });

  it("merges dirty flags into one flush and survives thrown handlers", () => {
    const batcher = new DirtyBatcher();
    batcher.mark(SDKDirtyFlag.Materials);
    batcher.mark(SDKDirtyFlag.UVs);
    let seen = SDKDirtyFlag.None;
    batcher.flush((flags) => {
      seen = flags;
    });
    expect(seen).toBe(SDKDirtyFlag.Materials | SDKDirtyFlag.UVs);
    expect(batcher.flushCount).toBe(1);
    batcher.mark(SDKDirtyFlag.Selection);
    expect(() =>
      batcher.flush(() => {
        throw new Error("flush failed");
      }),
    ).toThrow("flush failed");
    batcher.mark(SDKDirtyFlag.Picking);
    let second = SDKDirtyFlag.None;
    batcher.flush((flags) => {
      second = flags;
    });
    expect(second).toBe(SDKDirtyFlag.Selection | SDKDirtyFlag.Picking);
    batcher.dispose();
    batcher.mark(SDKDirtyFlag.Hierarchy);
    expect(batcher.pendingFlags).toBe(SDKDirtyFlag.None);
  });

  it("rejects stale async job results", () => {
    expect(
      isStaleJobResult({
        documentExists: true,
        targetExists: true,
        sourceRevision: 1,
        currentRevision: 2,
        cancelled: false,
        adapterDisposed: false,
        superseded: false,
      }),
    ).toBe(true);
  });

  it("tracks resource diagnostics without going negative", () => {
    const tracker = new ResourceDiagnosticsTracker();
    tracker.increment("workers", 2);
    tracker.decrement("workers", 5);
    expect(tracker.snapshot().workers).toBe(0);
    tracker.increment("subscriptions");
    expect(tracker.snapshot().subscriptions).toBe(1);
  });

  it("caps recursive dirty flushes", () => {
    const batcher = new DirtyBatcher();
    let passes = 0;
    batcher.mark(SDKDirtyFlag.Selection);
    batcher.flush(() => {
      passes += 1;
      batcher.mark(SDKDirtyFlag.Picking);
    });
    expect(passes).toBeLessThanOrEqual(8);
    batcher.dispose();
  });

  it("tracks object URLs and revokes them on dispose", () => {
    const registry = new ObjectUrlRegistry();
    registry.track("blob:test-1");
    registry.track("blob:test-2");
    expect(registry.size).toBe(2);
    registry.revoke("blob:test-1");
    expect(registry.size).toBe(1);
    registry.dispose();
    registry.dispose();
    expect(registry.disposed).toBe(true);
    expect(registry.size).toBe(0);
    expect(() => registry.track("blob:test-3")).toThrow(/disposed/);
  });
});
