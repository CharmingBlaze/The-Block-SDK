import { describe, expect, it } from "vitest";
import { clientToViewportPixel } from "../src/gpu-picking/viewport-pixel";

const full = { x: 0, y: 0, width: 100, height: 100 };

describe("clientToViewportPixel", () => {
  it("maps DPR 1 top-left and bottom-right pixels with Y inversion", () => {
    const canvas = { left: 0, top: 0, width: 100, height: 100 };
    expect(clientToViewportPixel(0, 0, canvas, full, 100, 100)).toEqual({ x: 0, y: 99 });
    expect(clientToViewportPixel(99.9, 99.9, canvas, full, 100, 100)).toEqual({ x: 99, y: 0 });
  });

  it("scales DPR 2 and DPR 1.5 drawing buffers", () => {
    const canvas = { left: 0, top: 0, width: 100, height: 100 };
    expect(clientToViewportPixel(0, 0, canvas, full, 200, 200)).toEqual({ x: 0, y: 199 });
    expect(clientToViewportPixel(50, 50, canvas, full, 200, 200)).toEqual({ x: 100, y: 99 });
    expect(clientToViewportPixel(0, 0, canvas, full, 150, 150)).toEqual({ x: 0, y: 149 });
    expect(clientToViewportPixel(99.9, 99.9, canvas, full, 150, 150)).toEqual({ x: 149, y: 0 });
  });

  it("accounts for an offset canvas", () => {
    const canvas = { left: 40, top: 20, width: 100, height: 100 };
    expect(clientToViewportPixel(40, 20, canvas, full, 100, 100)).toEqual({ x: 0, y: 99 });
    expect(clientToViewportPixel(90, 70, canvas, full, 100, 100)).toEqual({ x: 50, y: 49 });
  });

  it("rejects pointers outside a split viewport", () => {
    const canvas = { left: 0, top: 0, width: 200, height: 100 };
    const right = { x: 100, y: 0, width: 100, height: 100 };
    expect(clientToViewportPixel(50, 50, canvas, right, 200, 100)).toBeUndefined();
    expect(clientToViewportPixel(150, 50, canvas, right, 200, 100)).toEqual({ x: 50, y: 49 });
  });

  it("returns undefined for pointers outside the canvas", () => {
    const canvas = { left: 10, top: 10, width: 100, height: 100 };
    expect(clientToViewportPixel(0, 0, canvas, full, 100, 100)).toBeUndefined();
    expect(clientToViewportPixel(200, 50, canvas, full, 100, 100)).toBeUndefined();
  });

  it("uses the same conversion for maximized viewports as the full canvas", () => {
    const canvas = { left: 0, top: 0, width: 1920, height: 1080 };
    const maximized = { x: 0, y: 0, width: 1920, height: 1080 };
    const pixel = clientToViewportPixel(960, 540, canvas, maximized, 1920, 1080);
    expect(pixel).toEqual({ x: 960, y: 539 });
  });
});
