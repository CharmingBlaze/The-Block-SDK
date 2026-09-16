import { describe, expect, it } from "vitest";
import { BoundingBox, buildAabbBvh, Ray, raycastAabbBvh, Vector3 } from "../src";

describe("AABB BVH", () => {
  it("returns the closest primitive along a ray", () => {
    const tree = buildAabbBvh([
      {
        item: "far",
        bounds: BoundingBox.fromMinMax({ x: -0.5, y: -0.5, z: 4 }, { x: 0.5, y: 0.5, z: 5 }),
      },
      {
        item: "near",
        bounds: BoundingBox.fromMinMax({ x: -0.5, y: -0.5, z: 1 }, { x: 0.5, y: 0.5, z: 2 }),
      },
      {
        item: "miss",
        bounds: BoundingBox.fromMinMax({ x: 10, y: 10, z: 0 }, { x: 11, y: 11, z: 1 }),
      },
    ]);
    const hit = raycastAabbBvh(tree, new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1)));
    expect(hit?.item).toBe("near");
    expect(hit?.distance).toBeCloseTo(1);
  });

  it("returns null for an empty tree or a miss", () => {
    expect(raycastAabbBvh(undefined, new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1)))).toBeNull();
    const tree = buildAabbBvh([
      {
        item: "box",
        bounds: BoundingBox.fromMinMax({ x: 2, y: 2, z: 2 }, { x: 3, y: 3, z: 3 }),
      },
    ]);
    expect(raycastAabbBvh(tree, new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1)))).toBeNull();
  });

  it("splits more than a leaf of primitives", () => {
    const primitives = Array.from({ length: 8 }, (_, index) => ({
      item: `box-${index}`,
      bounds: BoundingBox.fromMinMax(
        { x: index * 2, y: -0.5, z: -0.5 },
        { x: index * 2 + 1, y: 0.5, z: 0.5 },
      ),
    }));
    const tree = buildAabbBvh(primitives);
    expect(tree?.kind).toBe("branch");
    const hit = raycastAabbBvh(tree, new Ray(new Vector3(-1, 0, 0), new Vector3(1, 0, 0)));
    expect(hit?.item).toBe("box-0");
    expect(hit?.distance).toBeCloseTo(1);
  });
});
