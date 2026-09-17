import { brand } from "@modeling-kit/core";
import { createModelingSession } from "@modeling-kit/commands";
import type { PointPickResult } from "@modeling-kit/selection";
import { PerspectiveCamera, MOUSE } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { describe, expect, it } from "vitest";
import { bindViewportPointer } from "../src/viewport-pointer";
import { createOrbitEventGate } from "../src/orbit-event-gate";
import { createViewportGestureController } from "../src/viewport-gesture-controller";
import {
  applyPickingOrbitPointerMap,
  applyViewportNavigation,
  cameraAtMinDistanceOnLookRay,
  createPickingOrbitPointerMap,
  DEFAULT_VIEWPORT_CAMERA_POSITION,
  isPointInsideAabb,
  resolvePickingNavigation,
  VIEWPORT_MOUSE_UNUSED,
  VIEWPORT_PICKING_MIN_DISTANCE,
} from "../src/viewport-pointer-policy";
import { DEFAULT_PICKING_NAVIGATION } from "../src/viewport-gesture-types";
import { resolvedPickingOptions } from "../src/viewport-types";
import { isClickNotDrag } from "../src/pick-selection";
import type { ThreeViewportAdapter } from "../src/adapter";
import type { CreateThreeViewportOptions } from "../src/viewport-types";

type CanvasStub = ReturnType<typeof fakeCanvas>;

function createDispatchTarget() {
  const listeners = new Map<string, EventListenerOrEventListenerObject[]>();
  return {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const set = listeners.get(type) ?? [];
      set.push(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      listeners.set(
        type,
        set.filter((entry) => entry !== listener),
      );
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(event.type) ?? []) {
        if (typeof listener === "function") {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
      return true;
    },
  };
}

function fakeCanvas() {
  const listeners = new Map<string, { listener: EventListenerOrEventListenerObject; capture: boolean }[]>();
  const captureByPointer = new Set<number>();
  const ownerDocument = createDispatchTarget();
  const root = createDispatchTarget();
  return {
    style: {} as { touchAction?: string },
    clientWidth: 800,
    clientHeight: 600,
    isConnected: true,
    ownerDocument: ownerDocument as unknown as Document,
    captureCount: 0,
    releaseCount: 0,
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      const capture = typeof options === "boolean" ? options : options?.capture === true;
      const set = listeners.get(type) ?? [];
      set.push({ listener, capture });
      listeners.set(type, set);
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) {
      const capture = typeof options === "boolean" ? options : options?.capture === true;
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      listeners.set(
        type,
        set.filter((entry) => entry.listener !== listener || entry.capture !== capture),
      );
    },
    dispatch(type: string, event: Event) {
      const entries = listeners.get(type) ?? [];
      const ordered = [...entries.filter((entry) => entry.capture), ...entries.filter((entry) => !entry.capture)];
      for (const entry of ordered) {
        const listener = entry.listener;
        if (typeof listener === "function") {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() { return this; } };
    },
    setPointerCapture(pointerId: number) {
      this.captureCount += 1;
      captureByPointer.add(pointerId);
    },
    hasPointerCapture(pointerId: number) {
      return captureByPointer.has(pointerId);
    },
    releasePointerCapture(pointerId: number) {
      this.releaseCount += 1;
      captureByPointer.delete(pointerId);
    },
    getRootNode() {
      return root;
    },
    count(type: string) {
      return listeners.get(type)?.length ?? 0;
    },
  };
}

function pointerEvent(type: string, extra: Record<string, unknown> = {}): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  const clientX = extra.clientX ?? 10;
  const clientY = extra.clientY ?? 10;
  Object.assign(event, {
    button: 0,
    buttons: type === "pointerdown" || type === "pointermove" ? 1 : 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX,
    clientY,
    pageX: clientX,
    pageY: clientY,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() {
      return undefined;
    },
    ...extra,
  });
  return event;
}

function stubAdapter(hit?: PointPickResult): ThreeViewportAdapter {
  const objectId = hit?.objectId ?? brand<string, "ObjectId">("obj-1");
  return {
    pick: () => null,
    pickPoint: async () => hit,
    pickingRevisions: () => ({ scene: 0, camera: 0 }),
    lastPickSource: "gpu-id-buffer",
    setHover: () => undefined,
    objectId,
  } as unknown as ThreeViewportAdapter;
}

function identityHit(objectId = brand<string, "ObjectId">("obj-1")): PointPickResult {
  return {
    kind: "identity",
    source: "cpu-raycast",
    domain: "object",
    objectId,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function orbitCamera() {
  const camera = new PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(...DEFAULT_VIEWPORT_CAMERA_POSITION);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function attachGestures(options: {
  canvas: CanvasStub;
  adapter?: ThreeViewportAdapter;
  viewport?: Partial<CreateThreeViewportOptions>;
  session?: CreateThreeViewportOptions["session"];
  pickingEnabled?: boolean;
}) {
  const session = options.session ?? createModelingSession();
  const adapter = options.adapter ?? stubAdapter();
  const viewport = {
    container: {} as HTMLElement,
    session,
    ...options.viewport,
  } as CreateThreeViewportOptions;
  const canvas = options.canvas as unknown as HTMLCanvasElement;
  const navigation = resolvePickingNavigation({ navigation: options.viewport?.navigation });
  const gate = createOrbitEventGate(canvas);
  const controlSlot: { controls?: OrbitControls } = {};
  const gestureSlot: { applyClaim?: (pointerId: number, claim: { owner: "tool"; beginDrag?: boolean }) => boolean } = {};
  const binding = bindViewportPointer({
    canvas,
    adapter,
    viewport,
    pickingEnabled: options.pickingEnabled !== false,
    pickDomain: "object",
    attachListeners: false,
    onBeginToolDrag: (pointerId) => {
      gestureSlot.applyClaim?.(pointerId, { owner: "tool", beginDrag: true });
    },
    isDisposed: () => false,
  });
  const gestures = createViewportGestureController({
    canvas,
    attachListeners: options.pickingEnabled !== false,
    pickingEnabled: options.pickingEnabled !== false,
    navigation,
    getControls: () => controlSlot.controls,
    getNavigationTarget: () => gate,
    onSelectionDown: binding.handlePointerDown,
    onSelectionMove: binding.handlePointerMove,
    onSelectionUp: binding.handlePointerUp,
    onSelectionCancel: binding.handlePointerCancel,
  });
  gestureSlot.applyClaim = (pointerId, claim) => gestures.applyClaim(pointerId, claim);
  return { session, binding, gestures, gate, navigation, controlSlot };
}

function mountControls(
  canvas: CanvasStub,
  gate: ReturnType<typeof createOrbitEventGate>,
  navigation = DEFAULT_PICKING_NAVIGATION,
) {
  const camera = orbitCamera();
  const controls = new OrbitControls(camera, gate as unknown as HTMLElement);
  controls.enableDamping = false;
  applyViewportNavigation(controls, navigation);
  return { camera, controls };
}

describe("viewport pointer host wiring", () => {
  it("attaches no pointer handlers when picking is disabled", () => {
    const canvas = fakeCanvas();
    const binding = bindViewportPointer({
      canvas: canvas as unknown as HTMLCanvasElement,
      adapter: stubAdapter(),
      viewport: { container: {} as HTMLElement, session: {} as CreateThreeViewportOptions["session"] },
      pickingEnabled: false,
      pickDomain: "face",
      isDisposed: () => false,
    });
    expect(canvas.count("pointerdown")).toBe(0);
    expect(canvas.count("pointerup")).toBe(0);
    expect(canvas.count("pointermove")).toBe(0);
    expect(typeof binding.pickFromClient).toBe("function");
    binding.dispose();
  });

  it("treats large motion as a drag", () => {
    expect(isClickNotDrag(0, 0, 20, 0)).toBe(false);
  });

  it("never takes pointer capture on a select click", async () => {
    const canvas = fakeCanvas();
    const { binding, gestures } = attachGestures({ canvas });
    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { buttons: 0 }));
    await flush();
    expect(canvas.captureCount).toBe(0);
    expect(gestures.hasCapturedPointers()).toBe(false);
    binding.dispose();
    gestures.dispose();
  });

  it("keeps hover on CPU even when GPU click is enabled", () => {
    expect(resolvedPickingOptions({ gpuPicking: true }).hoverBackend).toBe("cpu");
    expect(resolvedPickingOptions({ gpuPicking: true }).gpuPicking).toBe(true);
  });

  it("still delivers left-button events to later canvas observers", () => {
    const canvas = fakeCanvas();
    const { gestures } = attachGestures({ canvas });
    let hostSaw = false;
    canvas.addEventListener("pointerdown", () => {
      hostSaw = true;
    });
    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    expect(hostSaw).toBe(true);
    expect(gestures.owner).toBe("selection");
    gestures.dispose();
  });
});

describe("ViewportGestureController", () => {
  it("selects on left click without moving the camera", async () => {
    const canvas = fakeCanvas();
    const objectId = brand<string, "ObjectId">("mesh-1");
    const hit = identityHit(objectId);
    const session = createModelingSession();
    const { binding, gestures, gate, controlSlot } = attachGestures({
      canvas,
      adapter: stubAdapter(hit),
      session,
    });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();
    const target = controls.target.clone();
    const zoom = camera.zoom;

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 400, clientY: 300 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 401, clientY: 300, buttons: 0 }));
    await flush();
    controls.update();

    expect(session.selection.objectIds).toEqual([objectId]);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(camera.position.y).toBeCloseTo(start.y);
    expect(camera.position.z).toBeCloseTo(start.z);
    expect(controls.target.x).toBeCloseTo(target.x);
    expect(controls.target.y).toBeCloseTo(target.y);
    expect(controls.target.z).toBeCloseTo(target.z);
    expect(camera.zoom).toBeCloseTo(zoom);
    expect(gestures.owner).toBe("idle");
    binding.dispose();
    gestures.dispose();
    controls.dispose();
  });

  it("clears selection on an empty replace click without moving the camera", async () => {
    const canvas = fakeCanvas();
    const objectId = brand<string, "ObjectId">("mesh-1");
    const session = createModelingSession();
    session.selection.replace({ domain: "object", objectIds: [objectId], elementIds: [] });
    const { gestures, gate, controlSlot } = attachGestures({
      canvas,
      adapter: stubAdapter(undefined),
      session,
    });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 10, clientY: 10, buttons: 0 }));
    await flush();
    controls.update();

    expect(session.selection.objectIds).toEqual([]);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(camera.position.y).toBeCloseTo(start.y);
    expect(camera.position.z).toBeCloseTo(start.z);
    gestures.dispose();
    controls.dispose();
  });

  it("does not orbit on an unclaimed left drag", () => {
    const canvas = fakeCanvas();
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();
    const radius = controls.getDistance();

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    canvas.dispatch("pointermove", pointerEvent("pointermove", { clientX: 80, clientY: 12, buttons: 1 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 80, clientY: 12, buttons: 0 }));
    controls.update();

    expect(controls.getDistance()).toBeCloseTo(radius);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(camera.position.z).toBeCloseTo(start.z);
    gestures.dispose();
    controls.dispose();
  });

  it("selects on left click and orbits after a configured left drag", () => {
    const canvas = fakeCanvas();
    const navigation = { mouseButtons: { left: "orbit" as const } };
    const { gestures, gate, controlSlot } = attachGestures({
      canvas,
      viewport: { navigation },
    });
    const { camera, controls } = mountControls(canvas, gate, resolvePickingNavigation({ navigation }));
    controlSlot.controls = controls;
    const start = camera.position.clone();

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    expect(gestures.owner).toBe("selection");
    canvas.dispatch("pointermove", pointerEvent("pointermove", { clientX: 80, clientY: 12, buttons: 1 }));
    expect(gestures.owner).toBe("navigation");
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 80, clientY: 12, buttons: 0 }));
    controls.update();

    expect(camera.position.x).not.toBeCloseTo(start.x, 5);
    gestures.dispose();
    controls.dispose();
  });

  it("orbits on right drag", () => {
    const canvas = fakeCanvas();
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();

    canvas.dispatch(
      "pointerdown",
      pointerEvent("pointerdown", { button: 2, buttons: 2, clientX: 100, clientY: 100 }),
    );
    expect(gestures.owner).toBe("navigation");
    canvas.dispatch(
      "pointermove",
      pointerEvent("pointermove", { button: -1, buttons: 2, clientX: 160, clientY: 40 }),
    );
    canvas.dispatch(
      "pointerup",
      pointerEvent("pointerup", { button: 2, buttons: 0, clientX: 160, clientY: 40 }),
    );
    controls.update();

    expect(camera.position.x).not.toBeCloseTo(start.x, 5);
    expect(gestures.owner).toBe("idle");
    gestures.dispose();
    controls.dispose();
  });

  it("pans on middle drag", () => {
    const canvas = fakeCanvas();
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const target = controls.target.clone();

    canvas.dispatch(
      "pointerdown",
      pointerEvent("pointerdown", { button: 1, buttons: 4, clientX: 100, clientY: 100 }),
    );
    expect(gestures.owner).toBe("navigation");
    canvas.dispatch(
      "pointermove",
      pointerEvent("pointermove", { button: -1, buttons: 4, clientX: 180, clientY: 40 }),
    );
    canvas.dispatch(
      "pointerup",
      pointerEvent("pointerup", { button: 1, buttons: 0, clientX: 180, clientY: 40 }),
    );
    controls.update();

    const moved =
      Math.abs(controls.target.x - target.x) +
      Math.abs(controls.target.y - target.y) +
      Math.abs(controls.target.z - target.z);
    expect(moved).toBeGreaterThan(0.001);
    gestures.dispose();
    controls.dispose();
  });

  it("dollies on wheel", () => {
    const canvas = fakeCanvas();
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const radius = controls.getDistance();

    const wheel = new Event("wheel", { bubbles: true, cancelable: true }) as WheelEvent;
    Object.assign(wheel, { deltaY: 120, deltaX: 0, deltaZ: 0, clientX: 400, clientY: 300 });
    canvas.dispatch("wheel", wheel);
    controls.update();

    expect(controls.getDistance()).not.toBeCloseTo(radius, 5);
    gestures.dispose();
    controls.dispose();
  });

  it("lets a gizmo drag mutate an object without starting navigation", () => {
    const canvas = fakeCanvas();
    const object = { x: 0 };
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();

    gestures.registerGizmo({
      hitTest: () => ({ owner: "gizmo", beginDrag: true }),
      onPointerMove(context) {
        object.x = context.event.clientX;
      },
    });

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    expect(gestures.owner).toBe("gizmo");
    canvas.dispatch("pointermove", pointerEvent("pointermove", { clientX: 90, clientY: 12, buttons: 1 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 90, clientY: 12, buttons: 0 }));
    controls.update();

    expect(object.x).toBe(90);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(camera.position.y).toBeCloseTo(start.y);
    expect(camera.position.z).toBeCloseTo(start.z);
    expect(gestures.owner).toBe("idle");
    gestures.dispose();
    controls.dispose();
  });

  it("does not start selection when a gizmo claims the same pointerdown", async () => {
    const canvas = fakeCanvas();
    const objectId = brand<string, "ObjectId">("mesh-1");
    const session = createModelingSession();
    const { gestures } = attachGestures({
      canvas,
      adapter: stubAdapter(identityHit(objectId)),
      session,
    });
    gestures.registerGizmo({
      hitTest: () => ({ owner: "gizmo", beginDrag: true }),
    });
    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { buttons: 0 }));
    await flush();
    expect(session.selection.objectIds).toEqual([]);
    gestures.dispose();
  });

  it("cancels a pointer gesture and is ready for the next click", async () => {
    const canvas = fakeCanvas();
    const objectId = brand<string, "ObjectId">("mesh-1");
    const session = createModelingSession();
    const { gestures, gate, controlSlot } = attachGestures({
      canvas,
      adapter: stubAdapter(identityHit(objectId)),
      session,
    });
    const { camera, controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const start = camera.position.clone();

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 20, clientY: 20 }));
    expect(gestures.owner).toBe("selection");
    gestures.cancelActiveGesture("selection-start");
    expect(gestures.owner).toBe("idle");
    expect(gestures.hasCapturedPointers()).toBe(false);
    expect(canvas.hasPointerCapture(1)).toBe(false);

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { clientX: 400, clientY: 300 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { clientX: 400, clientY: 300, buttons: 0 }));
    await flush();
    controls.update();

    expect(session.selection.objectIds).toEqual([objectId]);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(gestures.owner).toBe("idle");
    gestures.dispose();
    controls.dispose();
  });

  it("delivers every event to host hooks for a claimed gesture", () => {
    const canvas = fakeCanvas();
    const { gestures } = attachGestures({ canvas });
    const phases: string[] = [];
    gestures.setHooks({
      onPointerDown() {
        phases.push("down");
        return { owner: "tool", beginDrag: true };
      },
      onPointerMove() {
        phases.push("move");
      },
      onPointerUp() {
        phases.push("up");
      },
    });
    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    canvas.dispatch("pointermove", pointerEvent("pointermove", { clientX: 40, clientY: 12, buttons: 1 }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { buttons: 0 }));
    expect(phases).toEqual(["down", "move", "up"]);
    expect(canvas.captureCount).toBe(1);
    expect(canvas.hasPointerCapture(1)).toBe(false);
    gestures.dispose();
  });

  it("never assigns touch to selection", async () => {
    const canvas = fakeCanvas();
    const objectId = brand<string, "ObjectId">("mesh-1");
    const session = createModelingSession();
    const { gestures } = attachGestures({
      canvas,
      adapter: stubAdapter(identityHit(objectId)),
      session,
    });
    canvas.dispatch(
      "pointerdown",
      pointerEvent("pointerdown", { pointerType: "touch", pointerId: 9, clientX: 400, clientY: 300 }),
    );
    expect(gestures.owner).toBe("none");
    canvas.dispatch(
      "pointerup",
      pointerEvent("pointerup", { pointerType: "touch", pointerId: 9, buttons: 0 }),
    );
    await flush();
    expect(session.selection.objectIds).toEqual([]);
    gestures.dispose();
  });

  it("captures only for consumePick { consumed: true, beginDrag: true } and releases on up", async () => {
    const canvas = fakeCanvas();
    const { binding, gestures } = attachGestures({
      canvas,
      adapter: stubAdapter(identityHit()),
      viewport: {
        consumePick: () => ({ consumed: true, beginDrag: true }),
      },
    });

    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    await flush();
    expect(canvas.captureCount).toBe(1);
    expect(canvas.hasPointerCapture(1)).toBe(true);
    expect(gestures.owner).toBe("tool");

    canvas.dispatch("pointerup", pointerEvent("pointerup", { buttons: 0 }));
    expect(canvas.hasPointerCapture(1)).toBe(false);
    expect(gestures.owner).toBe("idle");
    binding.dispose();
    gestures.dispose();
  });

  it("does not capture when consumePick is true without beginDrag", async () => {
    const canvas = fakeCanvas();
    const { gestures } = attachGestures({
      canvas,
      adapter: stubAdapter(identityHit()),
      viewport: { consumePick: () => true },
    });
    canvas.dispatch("pointerdown", pointerEvent("pointerdown"));
    await flush();
    expect(canvas.captureCount).toBe(0);
    gestures.dispose();
  });
});

describe("picking orbit pointer map", () => {
  it("uses the public picking navigation defaults", () => {
    const map = createPickingOrbitPointerMap();
    const navigation = resolvePickingNavigation();
    expect(navigation).toEqual(DEFAULT_PICKING_NAVIGATION);
    expect(map.mouseButtons.LEFT).toBe(VIEWPORT_MOUSE_UNUSED);
    expect(map.mouseButtons.MIDDLE).toBe(MOUSE.PAN);
    expect(map.mouseButtons.RIGHT).toBe(MOUSE.ROTATE);
    expect(map.touches.ONE).toBe(VIEWPORT_MOUSE_UNUSED);
    expect(map.touches.TWO).toBe(VIEWPORT_MOUSE_UNUSED);
    expect(map.minDistance).toBe(VIEWPORT_PICKING_MIN_DISTANCE);
    expect(map.zoomToCursor).toBe(false);
  });

  it("overwrites a host that re-enables left-orbit while picking is on", () => {
    const canvas = fakeCanvas();
    const camera = orbitCamera();
    const controls = new OrbitControls(camera, canvas as unknown as HTMLCanvasElement);
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    applyViewportNavigation(controls, DEFAULT_PICKING_NAVIGATION);
    expect(controls.mouseButtons.LEFT).toBe(VIEWPORT_MOUSE_UNUSED);
    expect(controls.zoomToCursor).toBe(false);
    controls.dispose();
  });

  it("does not pinch-zoom leftover pointers when left clicks never reach Orbit", () => {
    const canvas = fakeCanvas();
    const { gestures, gate, controlSlot } = attachGestures({ canvas });
    const { controls } = mountControls(canvas, gate);
    controlSlot.controls = controls;
    const radius = controls.getDistance();

    canvas.dispatch("pointerdown", pointerEvent("pointerdown", { pointerId: 1, pointerType: "mouse" }));
    canvas.dispatch("pointerup", pointerEvent("pointerup", { pointerId: 1, buttons: 0 }));
    canvas.dispatch(
      "pointerdown",
      pointerEvent("pointerdown", { pointerId: 11, pointerType: "touch", clientX: 10, clientY: 10 }),
    );
    canvas.dispatch(
      "pointerdown",
      pointerEvent("pointerdown", { pointerId: 12, pointerType: "touch", isPrimary: false, clientX: 40, clientY: 10 }),
    );
    canvas.dispatch(
      "pointermove",
      pointerEvent("pointermove", { pointerId: 12, pointerType: "touch", clientX: 200, clientY: 10, buttons: 1 }),
    );
    controls.update();

    expect(controls.getDistance()).toBeCloseTo(radius);
    expect(controls.minDistance).toBeGreaterThanOrEqual(VIEWPORT_PICKING_MIN_DISTANCE);
    gestures.dispose();
    controls.dispose();
  });

  it("keeps the camera outside a size-2 cube AABB after a leaked pinch to minDistance", () => {
    const canvas = fakeCanvas();
    const camera = orbitCamera();
    const controls = new OrbitControls(camera, canvas as unknown as HTMLCanvasElement);
    controls.enableDamping = false;
    applyPickingOrbitPointerMap(controls, createPickingOrbitPointerMap());

    camera.position.set(0.05, 0.05, 0.07);
    controls.target.set(0, 0, 0);
    controls.update();

    const cubeMin = { x: -1, y: -1, z: -1 };
    const cubeMax = { x: 1, y: 1, z: 1 };
    expect(isPointInsideAabb(camera.position, cubeMin, cubeMax)).toBe(false);
    expect(controls.getDistance()).toBeGreaterThanOrEqual(VIEWPORT_PICKING_MIN_DISTANCE);

    const atMin = cameraAtMinDistanceOnLookRay(
      { x: DEFAULT_VIEWPORT_CAMERA_POSITION[0], y: DEFAULT_VIEWPORT_CAMERA_POSITION[1], z: DEFAULT_VIEWPORT_CAMERA_POSITION[2] },
      { x: 0, y: 0, z: 0 },
      VIEWPORT_PICKING_MIN_DISTANCE,
    );
    expect(isPointInsideAabb(atMin, cubeMin, cubeMax)).toBe(false);
    controls.dispose();
  });
});
