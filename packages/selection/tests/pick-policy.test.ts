import { describe, expect, it } from "vitest";
import { defaultBackfaceMode, purposeNeedsSurface, resolvePickPolicy, type PointPickRequest } from "../src/picking";

function request(partial: Partial<PointPickRequest> & Pick<PointPickRequest, "domain">): PointPickRequest {
  return {
    clientX: 10,
    clientY: 10,
    canvasRect: { left: 0, top: 0, width: 100, height: 100 },
    ...partial,
  };
}

describe("pick policy routing", () => {
  it("uses GPU identity for visible object and face selection", () => {
    expect(resolvePickPolicy(request({ domain: "object", purpose: "selection" })).backend).toBe("gpu-id-buffer");
    expect(resolvePickPolicy(request({ domain: "face", purpose: "selection" })).backend).toBe("gpu-id-buffer");
    expect(resolvePickPolicy(request({ domain: "face", purpose: "knife" })).requireSurfacePoint).toBe(true);
  });

  it("forces CPU for hover, snap, x-ray, select-through, vertices, and edges", () => {
    expect(resolvePickPolicy(request({ domain: "face", purpose: "hover" })).backend).toBe("cpu-raycast");
    expect(resolvePickPolicy(request({ domain: "face", purpose: "snap" })).backend).toBe("cpu-raycast");
    expect(resolvePickPolicy(request({ domain: "face", xray: true })).backend).toBe("cpu-raycast");
    expect(resolvePickPolicy(request({ domain: "face", selectThrough: true })).backend).toBe("cpu-raycast");
    expect(resolvePickPolicy(request({ domain: "vertex" })).backend).toBe("cpu-raycast");
    expect(resolvePickPolicy(request({ domain: "edge" })).backend).toBe("cpu-raycast");
  });

  it("defaults object selection to front-and-back and faces to front-only", () => {
    expect(defaultBackfaceMode("object")).toBe("front-and-back");
    expect(defaultBackfaceMode("face")).toBe("front-only");
    expect(resolvePickPolicy(request({ domain: "object" })).backfaceMode).toBe("front-and-back");
    expect(resolvePickPolicy(request({ domain: "face" })).backfaceMode).toBe("front-only");
  });

  it("requires a surface point for knife, placement, and measurement tools", () => {
    expect(purposeNeedsSurface("knife")).toBe(true);
    expect(purposeNeedsSurface("placement")).toBe(true);
    expect(purposeNeedsSurface("measurement")).toBe(true);
    expect(purposeNeedsSurface("selection")).toBe(false);
    expect(purposeNeedsSurface("hover")).toBe(false);
  });
});
