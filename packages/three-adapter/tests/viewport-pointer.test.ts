import { describe, expect, it } from "vitest";
import { bindViewportPointer } from "../src/viewport-pointer";
import { resolvedPickingOptions } from "../src/viewport-types";
import { isClickNotDrag } from "../src/pick-selection";
import type { ThreeViewportAdapter } from "../src/adapter";
import type { CreateThreeViewportOptions } from "../src/viewport-types";

function fakeCanvas() {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    style: {},
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(listener);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() { return this; } };
    },
    setPointerCapture() {
      return undefined;
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function stubAdapter(): ThreeViewportAdapter {
  return {
    pick: () => null,
    pickPoint: async () => undefined,
    pickingRevisions: () => ({ scene: 0, camera: 0 }),
    lastPickSource: "gpu-id-buffer",
    setHover: () => undefined,
  } as unknown as ThreeViewportAdapter;
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

  it("attaches handlers when picking is enabled and treats large motion as a drag", () => {
    const canvas = fakeCanvas();
    const binding = bindViewportPointer({
      canvas: canvas as unknown as HTMLCanvasElement,
      adapter: stubAdapter(),
      viewport: { container: {} as HTMLElement, session: {} as CreateThreeViewportOptions["session"] },
      pickingEnabled: true,
      pickDomain: "object",
      isDisposed: () => false,
    });
    expect(canvas.count("pointerdown")).toBe(1);
    expect(isClickNotDrag(0, 0, 20, 0)).toBe(false);
    binding.dispose();
    expect(canvas.count("pointerdown")).toBe(0);
  });

  it("keeps hover on CPU even when GPU click is enabled", () => {
    expect(resolvedPickingOptions({ gpuPicking: true }).hoverBackend).toBe("cpu");
    expect(resolvedPickingOptions({ gpuPicking: true }).gpuPicking).toBe(true);
  });
});
