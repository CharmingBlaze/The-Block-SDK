import { brand } from "@modeling-kit/core";
import { createModelingSession } from "@modeling-kit/commands";
import { describe, expect, it } from "vitest";
import { applyPickSelection, clientToNdc, isClickNotDrag } from "../src/pick-selection";
import type { PickResult } from "../src/picking";

describe("viewport pick helpers", () => {
  it("converts client pixels to NDC", () => {
    const ndc = clientToNdc(150, 50, { left: 100, top: 0, width: 100, height: 100 });
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });

  it("treats small movement as a click", () => {
    expect(isClickNotDrag(0, 0, 2, 2)).toBe(true);
    expect(isClickNotDrag(0, 0, 20, 0)).toBe(false);
  });

  it("writes face picks into session selection and clears on miss", () => {
    const session = createModelingSession();
    const objectId = brand<string, "ObjectId">("obj-1");
    const faceId = brand<string, "FaceId">("face-1");
    const hit: PickResult = {
      domain: "face",
      objectId,
      elementId: faceId,
      faceId,
      point: { x: 0, y: 0, z: 0 },
      distance: 1,
    };
    applyPickSelection(session, hit);
    expect(session.selection.domain).toBe("face");
    expect(session.selection.objectIds).toEqual([objectId]);
    expect(session.selection.elementIds).toEqual([faceId]);
    applyPickSelection(session, null);
    expect(session.selection.domain).toBe("none");
    expect(session.selection.objectIds).toEqual([]);
  });
});
