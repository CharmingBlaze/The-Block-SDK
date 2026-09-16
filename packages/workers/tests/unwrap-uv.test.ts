import { describe, expect, it } from "vitest";
import { createInlineComputePool } from "../src/index";

describe("unwrap-uv worker task", () => {
  it("charts a triangulated cube on the inline pool", async () => {
    const positions = new Float32Array([
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
    ]);
    const indices = new Uint32Array([
      0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0, 1, 5, 6, 1, 6, 2, 4, 0, 3, 4, 3, 7,
    ]);
    const pool = createInlineComputePool();
    try {
      const result = await pool.unwrapUvAsync({ positions, indices }, { resolution: 128, padding: 1 });
      expect(result.triangleCount).toBe(12);
      expect(result.atlasWidth).toBeGreaterThan(0);
      expect(result.xref.length).toBe(result.vertexCount);
    } finally {
      pool.dispose();
    }
  });
});
