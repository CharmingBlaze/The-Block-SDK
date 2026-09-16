import { describe, expect, it } from "vitest";
import {
  decodePickId,
  encodePickId,
  GPU_PICK_BACKGROUND_ID,
  MAX_GPU_PICK_ID,
  pickIdToUnitRgb,
} from "../src/gpu-picking/encode";

describe("GPU pick ID encoding", () => {
  it("treats zero as background", () => {
    expect(GPU_PICK_BACKGROUND_ID).toBe(0);
    expect(decodePickId(0, 0, 0)).toBe(0);
  });

  it("round-trips 24-bit RGB IDs", () => {
    for (const id of [1, 2, 255, 256, 0x010203, 0x7f00ff, MAX_GPU_PICK_ID]) {
      const rgb = encodePickId(id);
      expect(decodePickId(rgb.r, rgb.g, rgb.b)).toBe(id);
      const unit = pickIdToUnitRgb(id);
      expect(decodePickId(unit.r * 255, unit.g * 255, unit.b * 255)).toBe(id);
    }
  });

  it("rejects overflow IDs", () => {
    expect(() => encodePickId(MAX_GPU_PICK_ID + 1)).toThrow(/outside/);
    expect(() => encodePickId(-1)).toThrow(/outside/);
    expect(() => encodePickId(1.5)).toThrow(/outside/);
  });
});
