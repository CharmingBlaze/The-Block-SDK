import { brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  isIdentityPick,
  isSurfacePick,
  requireSurfacePick,
  type IdentityPickResult,
  type SurfacePickResult,
} from "../src/picking";

const objectId = brand<string, "ObjectId">("obj");
const meshId = brand<string, "MeshId">("mesh");
const faceId = brand<string, "FaceId">("face");

const identity: IdentityPickResult = {
  kind: "identity",
  source: "gpu-id-buffer",
  domain: "face",
  objectId,
  meshId,
  faceId,
};

const surface: SurfacePickResult = {
  kind: "surface",
  source: "gpu-plus-cpu-refinement",
  domain: "face",
  objectId,
  meshId,
  faceId,
  worldPoint: { x: 0.25, y: 0.1, z: 1 },
  localPoint: { x: 0.25, y: 0.1, z: 0 },
  worldNormal: { x: 0, y: 0, z: 1 },
  localNormal: { x: 0, y: 0, z: 1 },
  distance: 7,
  barycentric: { x: 0.5, y: 0.25, z: 0.25 },
  triangleIndex: 0,
};

describe("pick result typing", () => {
  it("keeps identity results free of fabricated positions", () => {
    expect(isIdentityPick(identity)).toBe(true);
    expect("worldPoint" in identity).toBe(false);
    expect("localPoint" in identity).toBe(false);
  });

  it("requires finite coordinates on surface results", () => {
    expect(isSurfacePick(surface)).toBe(true);
    expect(requireSurfacePick(surface).worldPoint.z).toBe(1);
  });

  it("rejects identity-only results when a surface point is required", () => {
    expect(() => requireSurfacePick(identity)).toThrow(/Surface point required/);
  });

  it("does not treat a missing position as a fabricated origin", () => {
    const asRecord = identity as unknown as Record<string, unknown>;
    expect(asRecord.worldPoint).toBeUndefined();
    expect(asRecord.point).toBeUndefined();
    expect(asRecord.localPoint).toBeUndefined();
  });
});
