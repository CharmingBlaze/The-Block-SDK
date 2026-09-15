import { describe, expect, it } from "vitest";
import { BruteForceSpatialQuery } from "../src/spatial-query";

describe("SpatialQueryBackend", () => {
  it("returns the closest hit from brute-force testers", () => {
    const backend = new BruteForceSpatialQuery([
      () => ({ objectId: "far", distance: 4, point: { x: 0, y: 0, z: 4 } }),
      () => ({ objectId: "near", distance: 1, point: { x: 0, y: 0, z: 1 } }),
    ]);
    const hit = backend.raycast({
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
    });
    expect(hit?.objectId).toBe("near");
    backend.dispose();
  });

  it("returns null when no testers are registered so CPU Raycaster remains canonical", () => {
    const backend = new BruteForceSpatialQuery();
    expect(
      backend.raycast({
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      }),
    ).toBeNull();
    backend.dispose();
  });
});
