import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { applyPickViewOffset, restoreViewOffset } from "../src/gpu-picking/camera-view-offset";

describe("pick camera view offset", () => {
  it("restores a cloned host view offset after a 1×1 pick", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.setViewOffset(800, 600, 100, 50, 600, 500);
    camera.updateProjectionMatrix();
    const previous = applyPickViewOffset(camera, 600, 500, 300, 249);
    expect(camera.view?.width).toBe(1);
    expect(previous?.offsetX).toBe(100);
    expect(previous?.width).toBe(600);
    restoreViewOffset(camera, previous);
    expect(camera.view?.fullWidth).toBe(800);
    expect(camera.view?.offsetX).toBe(100);
    expect(camera.view?.offsetY).toBe(50);
    expect(camera.view?.width).toBe(600);
    expect(camera.view?.height).toBe(500);
  });
});
