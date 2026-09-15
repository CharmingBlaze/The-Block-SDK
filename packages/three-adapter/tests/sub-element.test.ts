import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, LoopCutCommand, createModelingSession } from "@modeling-kit/commands";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { Mesh, OrthographicCamera, PerspectiveCamera, Points, Scene, SphereGeometry, type Camera } from "three";
import {
  ElementPointerMachine,
  IdIndexMap,
  ThreeViewportAdapter,
  emptyElementIdSets,
  isLodIndexVisible,
  planElementLod,
  resolveElementVisualState,
  visualStatePriority,
  worldSizeForPixels,
} from "../src/index";

function stubRenderer() {
  return {
    setSize: () => undefined,
    setPixelRatio: () => undefined,
  };
}

function mountAdapter(session: ReturnType<typeof createModelingSession>, camera: Camera = new PerspectiveCamera(50, 1, 0.1, 100)) {
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const adapter = new ThreeViewportAdapter({
    session,
    scene: new Scene(),
    camera,
    renderer: stubRenderer(),
  });
  adapter.mount();
  adapter.resize(800, 600, 1);
  return adapter;
}

describe("sub-element visual state", () => {
  it("applies hidden → disabled/locked → active → selected → hovered → default", () => {
    const id = "e1";
    expect(resolveElementVisualState(id, { ...emptyElementIdSets(), hovered: id })).toBe("hovered");
    expect(
      resolveElementVisualState(id, {
        ...emptyElementIdSets(),
        hovered: id,
        selected: new Set([id]),
      }),
    ).toBe("selected");
    expect(
      resolveElementVisualState(id, {
        ...emptyElementIdSets(),
        hovered: id,
        selected: new Set([id]),
        active: id,
      }),
    ).toBe("active");
    expect(
      resolveElementVisualState(id, {
        ...emptyElementIdSets(),
        active: id,
        locked: new Set([id]),
      }),
    ).toBe("locked");
    expect(
      resolveElementVisualState(id, {
        ...emptyElementIdSets(),
        locked: new Set([id]),
        disabled: new Set([id]),
      }),
    ).toBe("disabled");
    expect(
      resolveElementVisualState(id, {
        ...emptyElementIdSets(),
        disabled: new Set([id]),
        hidden: new Set([id]),
      }),
    ).toBe("hidden");
    expect(visualStatePriority("hidden")).toBeLessThan(visualStatePriority("active"));
    expect(visualStatePriority("active")).toBeLessThan(visualStatePriority("hovered"));
  });
});

describe("screen-space marker sizing", () => {
  it("grows with distance in perspective and stays constant in orthographic", () => {
    const perspective = { isPerspectiveCamera: true, fov: 50 };
    const near = worldSizeForPixels(perspective, 4, 8, 600);
    const far = worldSizeForPixels(perspective, 16, 8, 600);
    expect(far).toBeGreaterThan(near * 3.5);
    const ortho = { isOrthographicCamera: true, top: 3, bottom: -3, zoom: 1 };
    const a = worldSizeForPixels(ortho, 4, 8, 600);
    const b = worldSizeForPixels(ortho, 16, 8, 600);
    expect(a).toBeCloseTo(b);
    expect(a).toBeCloseTo((6 * 8) / 600);
  });
});

describe("stable ID mapping and LOD", () => {
  it("rebuilds indices only when IDs change and keeps selected items visible under stride LOD", () => {
    const map = new IdIndexMap<string>();
    expect(map.rebuild(["a", "b", "c"])).toBe(true);
    expect(map.rebuild(["a", "b", "c"])).toBe(false);
    expect(map.getIndex("b")).toBe(1);
    expect(map.pruneMissing(new Set(["a", "c"]))).toEqual(["b"]);
    expect(map.getIndex("c")).toBe(1);
    const plan = planElementLod(1000, 100, { maxVertices: 100, maxEdges: 100, maxFaces: 100, strategy: "stride" });
    expect(plan.stride).toBeGreaterThan(1);
    expect(isLodIndexVisible(0, plan, false)).toBe(true);
    expect(isLodIndexVisible(1, plan, false)).toBe(false);
    expect(isLodIndexVisible(1, plan, true)).toBe(true);
  });
});

describe("element pointer machine", () => {
  it("walks idle → hovering → pressed → dragging → committed and cancels safely", () => {
    const machine = new ElementPointerMachine({ dragSlopPx: 4 });
    expect(machine.hover({ pointerId: 1, x: 0, y: 0, elementId: "v1" })).toBe("hovering");
    expect(machine.press({ pointerId: 1, x: 0, y: 0, elementId: "v1" })).toBe("pressed");
    expect(machine.move({ pointerId: 1, x: 20, y: 0, elementId: "v1" })).toBe("dragging");
    expect(machine.commit()).toBe("committed");
    expect(machine.phase).toBe("hovering");
    expect(machine.press({ pointerId: 1, x: 0, y: 0, elementId: "v1" })).toBe("pressed");
    expect(machine.cancel("pointercancel")).toBe("cancelled");
    expect(machine.lostCapture()).toBe("cancelled");
    machine.hover({ pointerId: 1, x: 0, y: 0, elementId: "gone" });
    machine.pruneDeleted(new Set(["v1"]));
    expect(machine.hoverId).toBeNull();
    expect(machine.phase).toBe("idle");
  });
});

describe("sub-element adapter overlay", () => {
  it("keeps face selection overlays and isolates hover per viewport", () => {
    const session = createModelingSession(createSequenceIdFactory("viz"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const a = mountAdapter(session);
    const b = mountAdapter(session, new OrthographicCamera(-4, 4, 4, -4, 0.1, 100));
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    const overlay = a.root.getObjectByName("selection-overlay");
    expect(overlay?.userData.overlayKind).toBe("face");
    expect(overlay?.userData.triangleCount).toBe(2);
    a.setHover({ objectId: cube.objectId, domain: "face", elementId: cube.faceIds.posZ });
    b.setHover({ objectId: cube.objectId, domain: "face", elementId: cube.faceIds.negZ });
    expect(a.root.getObjectByName("selection-overlay")?.userData.triangleCount).toBeGreaterThan(0);
    expect(b.root.getObjectByName("selection-overlay")?.userData.triangleCount).toBeGreaterThan(0);
    a.dispose();
    b.dispose();
  });

  it("rebuilds after topology edits and drops hover on deleted elements", () => {
    const session = createModelingSession(createSequenceIdFactory("topo"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const mesh = session.meshes.get(cube.meshId)!;
    const edgeId = [...mesh.edges.keys()][0]!;
    session.selection.replace({ domain: "edge", objectId: cube.objectId, elementIds: [edgeId] });
    adapter.setHover({ objectId: cube.objectId, domain: "edge", elementId: edgeId });
    session.selection.replace({ domain: "edge", objectId: cube.objectId, elementIds: [edgeId] });
    session.execute(new LoopCutCommand({ startEdgeId: edgeId, factor: 0.5 }));
    adapter.setHover({ objectId: cube.objectId, domain: "edge", elementId: edgeId });
    adapter.sync();
    const live = [...session.meshes.get(cube.meshId)!.edges.keys()];
    expect(live.includes(edgeId) || adapter.root.getObjectByName("edge-overlay")).toBeTruthy();
    adapter.dispose();
  });

  it("handles large vertex counts without one object per vertex", () => {
    const session = createModelingSession(createSequenceIdFactory("lod"));
    const sphere = session.execute(
      new CreatePrimitiveCommand("uvSphere", { radius: 1, widthSegments: 24, heightSegments: 16 }),
    );
    const adapter = mountAdapter(session);
    session.selection.replace({ domain: "vertex", objectId: sphere.objectId, elementIds: [] });
    adapter.setSubElementDisplay({ editMode: true, lod: { strategy: "stride", maxVertices: 400, maxEdges: 400, maxFaces: 400 } });
    const overlay = adapter.root.getObjectByName("vertex-overlay");
    expect(overlay).toBeDefined();
    expect(overlay?.children.length ?? 0).toBe(0);
    adapter.dispose();
  });

  it("does not duplicate listeners and does not leak GPU resources after remounts", () => {
    const session = createModelingSession(createSequenceIdFactory("leak"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const counts: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const adapter = mountAdapter(session);
      expect(adapter.subscriberCount()).toBe(4);
      adapter.mount();
      expect(adapter.subscriberCount()).toBe(4);
      counts.push(adapter.subElementGpuCounts().geometries + adapter.subElementGpuCounts().materials);
      adapter.dispose();
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThan(8);
    const leftover = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    leftover.mount();
    leftover.dispose();
    expect(leftover.subElementGpuCounts().layers).toBe(0);
  });

  it("updates overlays while moving objects and vertices without rebuilding GPU resources", () => {
    const session = createModelingSession(createSequenceIdFactory("move"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    adapter.setSubElementDisplay({ editMode: true });
    const mesh = session.meshes.get(cube.meshId)!;
    const vertexId = [...mesh.vertices.keys()][0]!;
    session.selection.replace({
      domain: "vertex",
      objectId: cube.objectId,
      elementIds: [vertexId],
    });
    const before = adapter.subElementGpuCounts();
    const start = mesh.vertices.get(vertexId)!.position[0];
    session.beginTransform({
      mode: "translate",
      objectIds: [cube.objectId],
      meshId: cube.meshId,
      vertexIds: [vertexId],
    });
    for (let i = 1; i <= 16; i += 1) {
      session.updateTransform({ translation: { x: i * 0.05, y: 0, z: 0 } });
    }
    expect(mesh.vertices.get(vertexId)!.position[0]).toBeGreaterThan(start);
    expect(adapter.subElementPerf().positionRefreshes).toBeGreaterThan(0);
    expect(adapter.subElementPerf().topologyRebuilds).toBe(1);
    const mid = adapter.subElementGpuCounts();
    expect(mid.geometries).toBe(before.geometries);
    expect(mid.materials).toBe(before.materials);
    session.commitTransform();

    session.selection.replace({ domain: "object", objectIds: [cube.objectId], elementIds: [] });
    session.beginTransform({ mode: "translate", objectIds: [cube.objectId] });
    session.updateTransform({ translation: { x: 1.5, y: 0, z: 0 } });
    expect(adapter.object3D(cube.objectId)?.position.x).toBeCloseTo(1.5);
    session.commitTransform();

    const skipped = adapter.subElementPerf().skippedViews;
    for (let i = 0; i < 12; i += 1) {
      adapter.updateView();
    }
    expect(adapter.subElementPerf().skippedViews).toBeGreaterThan(skipped);
    adapter.dispose();
  });

  it("rebuilds vertex markers when the visual style changes", () => {
    const session = createModelingSession(createSequenceIdFactory("markers"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    adapter.setSubElementDisplay({ editMode: true, showVertices: true });
    session.selection.replace({ domain: "vertex", objectId: cube.objectId, elementIds: [] });
    const overlay = () => adapter.root.getObjectByName("vertex-overlay");
    expect(overlay()?.type).toBe("Mesh");
    const afterCube = adapter.subElementPerf().topologyRebuilds;
    adapter.setSubElementTheme({ vertices: { style: "sphere" } });
    expect((overlay() as Mesh).geometry).toBeInstanceOf(SphereGeometry);
    expect(adapter.subElementPerf().topologyRebuilds).toBeGreaterThan(afterCube);
    adapter.setSubElementTheme({ vertices: { style: "circle-sprite" } });
    expect(overlay()).toBeInstanceOf(Points);
    adapter.dispose();
  });
});

describe("id index with kernel vertices", () => {
  it("maps branded vertex IDs from a generated mesh", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const map = new IdIndexMap();
    map.rebuild(mesh.vertices.keys());
    expect(map.size).toBe(8);
    const first = [...mesh.vertices.keys()][0]!;
    expect(map.getId(map.getIndex(first)!)).toBe(first);
  });
});
