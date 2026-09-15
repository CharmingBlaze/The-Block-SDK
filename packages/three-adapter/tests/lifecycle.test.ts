import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession } from "@modeling-kit/commands";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene } from "three";
import {
  CompactElementStates,
  ElementPointerMachine,
  ElementStateFlag,
  IllegalLifecycleTransitionError,
  MeshVisualDirtyFlag,
  MeshVisualLifecycleMachine,
  MeshVisualScheduler,
  PickRequestGate,
  ThreeViewportAdapter,
  ViewportHoverStore,
  collectAffectedFromVertices,
  flagsToVisualState,
  remapHover,
  remapIdList,
  remapStableId,
} from "../src/index";

function stubRenderer() {
  return {
    setSize: () => undefined,
    setPixelRatio: () => undefined,
  };
}

function mountAdapter(session: ReturnType<typeof createModelingSession>, viewportId?: string) {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const adapter = new ThreeViewportAdapter({
    session,
    scene: new Scene(),
    camera,
    renderer: stubRenderer(),
    ...(viewportId !== undefined ? { viewportId } : {}),
  });
  adapter.mount();
  adapter.resize(800, 600, 1);
  return adapter;
}

describe("mesh visual lifecycle", () => {
  it("allows the documented transitions and rejects illegal ones", () => {
    const machine = new MeshVisualLifecycleMachine();
    expect(machine.state).toBe("uninitialized");
    expect(machine.transition("building")).toBe(true);
    expect(machine.transition("ready")).toBe(true);
    expect(machine.transition("updating")).toBe(true);
    expect(machine.transition("ready")).toBe(true);
    expect(machine.transition("suspended")).toBe(true);
    expect(machine.transition("ready")).toBe(true);
    expect(() => machine.transition("building")).toThrow(IllegalLifecycleTransitionError);
  });

  it("disposes repeatedly, after partial construction, and after failure", () => {
    const partial = new MeshVisualLifecycleMachine();
    partial.dispose();
    partial.dispose();
    expect(partial.state).toBe("disposed");

    const failed = new MeshVisualLifecycleMachine();
    failed.transition("building");
    failed.transition("failed");
    failed.dispose();
    failed.dispose();
    expect(failed.state).toBe("disposed");
  });

  it("does not update a disposed adapter", () => {
    const session = createModelingSession(createSequenceIdFactory("dead"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const adapter = mountAdapter(session);
    adapter.dispose();
    adapter.dispose();
    expect(() => adapter.setHover(null)).toThrow(/disposed/);
  });
});

describe("mesh visual scheduler", () => {
  it("merges invalidations and flushes once per frame", () => {
    const flushed: number[] = [];
    const scheduler = new MeshVisualScheduler({
      flushMesh: (_id, flags) => {
        flushed.push(flags);
      },
    });
    scheduler.invalidate("m1", MeshVisualDirtyFlag.Positions);
    scheduler.invalidate("m1", MeshVisualDirtyFlag.VertexStates);
    scheduler.flush(7);
    expect(scheduler.flushCount).toBe(1);
    expect(flushed).toEqual([MeshVisualDirtyFlag.Positions | MeshVisualDirtyFlag.VertexStates]);
    scheduler.invalidate("m1", MeshVisualDirtyFlag.Theme);
    scheduler.flush(7);
    expect(scheduler.flushCount).toBe(1);
    scheduler.flush(8);
    expect(scheduler.flushCount).toBe(2);
  });

  it("releases the flush lock when the handler throws", () => {
    const scheduler = new MeshVisualScheduler({
      flushMesh: () => {
        throw new Error("flush failed");
      },
    });
    scheduler.invalidate("m1", MeshVisualDirtyFlag.Topology);
    expect(() => scheduler.flushNow()).toThrow("flush failed");
    expect(scheduler.isFlushing).toBe(false);
    scheduler.invalidate("m1", MeshVisualDirtyFlag.Positions);
    let ran = false;
    const recovered = new MeshVisualScheduler({
      flushMesh: () => {
        ran = true;
      },
    });
    recovered.invalidate("m1", MeshVisualDirtyFlag.Positions);
    recovered.flushNow();
    expect(ran).toBe(true);
  });
});

describe("compact element states", () => {
  it("patches only old and new hover and selection entries", () => {
    const states = new CompactElementStates();
    states.resize(8);
    expect(flagsToVisualState(ElementStateFlag.Hidden | ElementStateFlag.Hovered)).toBe("hidden");
    expect(states.replaceHover(undefined, 2)).toBe(1);
    expect(states.replaceHover(2, 5)).toBe(2);
    expect(states.patchedIndices).toEqual([2, 5]);
    states.setFlag(1, ElementStateFlag.Selected, true);
    states.setFlag(3, ElementStateFlag.Selected, true);
    const previous = new Set([1, 3]);
    const next = new Set([3, 4]);
    expect(states.diffSelected(previous, next)).toBe(2);
    expect(states.patchedIndices.sort()).toEqual([1, 4]);
  });
});

describe("topology remap", () => {
  it("clears deleted hover and remaps or drops selected ids", () => {
    const mapping = {
      deleted: new Set(["e-old", "v-gone"]),
      replacedBy: new Map<string, readonly string[]>([["e-old", ["e-new"]]]),
    };
    expect(remapStableId("e-old", mapping)).toBe("e-new");
    expect(remapHover("v-gone", mapping)).toBeNull();
    expect(remapIdList(["e-old", "keep", "v-gone"], mapping)).toEqual(["e-new", "keep"]);
  });
});

describe("dependency graph", () => {
  it("expands incident edges and faces iteratively and reports truncation", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const vertexId = [...mesh.vertices.keys()][0]!;
    const affected = collectAffectedFromVertices(mesh, [vertexId]);
    expect(affected.truncated).toBe(false);
    expect(affected.vertices).toEqual([vertexId]);
    expect(affected.edges.length).toBeGreaterThan(0);
    expect(affected.faces.length).toBeGreaterThan(0);
    const limited = collectAffectedFromVertices(mesh, [...mesh.vertices.keys()], 2);
    expect(limited.truncated).toBe(true);
    expect(limited.vertices.length).toBeLessThanOrEqual(3);
  });

  it("cannot loop forever on cyclic adjacency", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const all = [...mesh.vertices.keys()];
    const affected = collectAffectedFromVertices(mesh, all, 1_000_000);
    expect(affected.truncated).toBe(false);
    expect(affected.vertices.length).toBe(8);
  });
});

describe("pointer interaction state", () => {
  it("restores on cancel and lost capture", () => {
    let restored = 0;
    let released = 0;
    const machine = new ElementPointerMachine({
      dragSlopPx: 2,
      onRestore: () => {
        restored += 1;
      },
      onReleaseCapture: () => {
        released += 1;
      },
    });
    machine.hover({ pointerId: 1, x: 0, y: 0, elementId: "v1" });
    machine.press({ pointerId: 1, x: 0, y: 0, elementId: "v1" });
    expect(machine.move({ pointerId: 1, x: 10, y: 0, elementId: "v1" })).toBe("dragging");
    expect(machine.lostCapture()).toBe("cancelled");
    expect(restored).toBe(1);
    expect(released).toBe(1);
    expect(machine.interactionState).toBe("hovering");
  });
});

describe("picking and viewport hover", () => {
  it("ignores stale pick request ids and keeps hover per viewport", () => {
    const gate = new PickRequestGate();
    const first = gate.next();
    const second = gate.next();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
    const store = new ViewportHoverStore();
    expect(
      store.applyIfCurrent({
        viewportId: "a",
        domain: "vertex",
        elementId: "v1",
        requestId: 2,
      }),
    ).toBe(true);
    expect(
      store.applyIfCurrent({
        viewportId: "a",
        domain: "vertex",
        elementId: "v2",
        requestId: 1,
      }),
    ).toBe(false);
    expect(store.get("a")?.elementId).toBe("v1");
    store.applyIfCurrent({
      viewportId: "b",
      domain: "edge",
      elementId: "e1",
      requestId: 1,
    });
    expect(store.get("b")?.elementId).toBe("e1");
    expect(store.get("a")?.elementId).toBe("v1");
    store.dispose();
    expect(store.get("a")).toBeUndefined();
  });
});

describe("adapter visual lifecycle integration", () => {
  it("patches hover entries without a topology rebuild", () => {
    const session = createModelingSession(createSequenceIdFactory("hover-patch"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session, "vp-a");
    adapter.setSubElementDisplay({ editMode: true });
    const mesh = session.meshes.get(cube.meshId)!;
    const ids = [...mesh.vertices.keys()];
    session.selection.replace({ domain: "vertex", objectId: cube.objectId, elementIds: [ids[0]!] });
    const rebuilds = adapter.subElementPerf().topologyRebuilds;
    adapter.setHover({ objectId: cube.objectId, domain: "vertex", elementId: ids[0]! });
    adapter.setHover({ objectId: cube.objectId, domain: "vertex", elementId: ids[1]! });
    expect(adapter.lastPatchedIndices().length).toBeGreaterThan(0);
    expect(adapter.lastPatchedIndices().length).toBeLessThanOrEqual(2);
    expect(adapter.subElementPerf().topologyRebuilds).toBe(rebuilds);
    adapter.dispose();
  });

  it("refreshes vertex buffers without a topology rebuild", () => {
    const session = createModelingSession(createSequenceIdFactory("xf-pos"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    adapter.setSubElementDisplay({ editMode: true });
    const mesh = session.meshes.get(cube.meshId)!;
    const vertexId = [...mesh.vertices.keys()][0]!;
    const rebuilds = adapter.subElementPerf().topologyRebuilds;
    session.beginTransform({
      mode: "translate",
      objectIds: [cube.objectId],
      meshId: cube.meshId,
      vertexIds: [vertexId],
    });
    session.updateTransform({ translation: { x: 0.35, y: 0, z: 0 } });
    expect(session.commitTransform()).toBe(true);
    expect(adapter.subElementPerf().topologyRebuilds).toBe(rebuilds);
    expect(adapter.subElementPerf().positionRefreshes).toBeGreaterThan(0);
    adapter.dispose();
  });

  it("cancels a vertex transform and restores positions", () => {
    const session = createModelingSession(createSequenceIdFactory("cancel-move"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const mesh = session.meshes.get(cube.meshId)!;
    const vertexId = [...mesh.vertices.keys()][0]!;
    const origin = mesh.vertices.get(vertexId)!.position[0];
    const machine = new ElementPointerMachine({
      onRestore: () => session.cancelTransform(),
    });
    session.beginTransform({
      mode: "translate",
      objectIds: [cube.objectId],
      meshId: cube.meshId,
      vertexIds: [vertexId],
    });
    machine.press({ pointerId: 1, x: 0, y: 0, elementId: vertexId });
    session.updateTransform({ translation: { x: 0.4, y: 0, z: 0 } });
    expect(mesh.vertices.get(vertexId)!.position[0]).not.toBe(origin);
    machine.cancel("escape");
    expect(mesh.vertices.get(vertexId)!.position[0]).toBe(origin);
    adapter.dispose();
  });

  it("does not grow subscriptions or GPU resources across remounts", () => {
    const session = createModelingSession(createSequenceIdFactory("diag"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const resources: number[] = [];
    const subscriptions: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const adapter = mountAdapter(session);
      const diag = adapter.subElementDiagnostics();
      resources.push(diag.activeResources);
      subscriptions.push(diag.activeSubscriptions);
      adapter.dispose();
      expect(adapter.subElementDiagnostics().lifecycle).toBe("disposed");
    }
    expect(new Set(subscriptions).size).toBe(1);
    expect(Math.max(...resources) - Math.min(...resources)).toBeLessThan(8);
  });

  it("rejects a stale hover request id", () => {
    const session = createModelingSession(createSequenceIdFactory("stale"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const a = mountAdapter(session, "left");
    const face = cube.faceIds.top;
    a.pickGate.next();
    a.setHover({ objectId: cube.objectId, domain: "face", elementId: face }, 1);
    a.setHover({ objectId: cube.objectId, domain: "face", elementId: cube.faceIds.bottom }, 0);
    expect(a.hoverStore.get("left")?.elementId).toBe(face);
    a.dispose();
  });

  it("shares session selection across viewports while keeping hover local", () => {
    const session = createModelingSession(createSequenceIdFactory("two-vp"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const left = mountAdapter(session, "left");
    const right = mountAdapter(session, "right");
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    left.setHover({ objectId: cube.objectId, domain: "face", elementId: cube.faceIds.top });
    right.setHover({ objectId: cube.objectId, domain: "face", elementId: cube.faceIds.bottom });
    expect(session.selection.elementIds).toEqual([cube.faceIds.top]);
    expect(left.hoverStore.get("left")?.elementId).toBe(cube.faceIds.top);
    expect(right.hoverStore.get("right")?.elementId).toBe(cube.faceIds.bottom);
    left.dispose();
    right.dispose();
  });
});
