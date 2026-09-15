import { describe, expect, it } from "vitest";
import {
  createKnifeOverlay,
  dashSegmentPositions,
  updateKnifeOverlay,
} from "../src/overlays/knife-overlay";
import { LineSegments, Points } from "three";

describe("knife overlay", () => {
  it("shows a perforated path and every vertex throughout the stroke", () => {
    const overlay = createKnifeOverlay();
    expect(overlay.visible).toBe(false);
    updateKnifeOverlay(overlay, {
      active: true,
      cursor: [1, 0, 0],
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      segments: [
        [
          [0, 0, 0],
          [1, 0, 0],
        ],
      ],
    });
    expect(overlay.visible).toBe(true);
    const guides = overlay.getObjectByName("knife-guides") as LineSegments;
    const vertices = overlay.getObjectByName("knife-vertices") as Points;
    const cursor = overlay.getObjectByName("knife-cursor") as Points;
    expect(guides.geometry.getAttribute("position").count).toBeGreaterThan(2);
    expect(vertices.geometry.getAttribute("position").count).toBe(2);
    expect(cursor.geometry.getAttribute("position").count).toBe(1);
    updateKnifeOverlay(overlay, null);
    expect(overlay.visible).toBe(false);
  });

  it("builds dashed segment positions", () => {
    const dashes = dashSegmentPositions([0, 0, 0], [1, 0, 0]);
    expect(dashes.length).toBeGreaterThanOrEqual(6);
    expect(dashes.length % 6).toBe(0);
  });
});
