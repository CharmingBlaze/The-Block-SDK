import { describe, expect, it } from "vitest";
import { SingularTransformError } from "@modeling-kit/core";
import {
  composeTransform,
  invertTransform,
  multiplyTransforms,
  transformPoint,
  tryInvertTransform,
  validateTransform,
} from "../src/transforms";
import { identityTransform } from "@modeling-kit/math";

describe("transforms", () => {
  it("rejects non-finite components", () => {
    const issues = validateTransform({
      position: { x: Number.NaN, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(issues[0]?.code).toBe("NON_FINITE");
  });

  it("handles negative scale and reports singular inversion", () => {
    const transform = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: -1, y: 1, z: 1 },
    };
    const point = transformPoint(transform, { x: 1, y: 0, z: 0 });
    expect(point.x).toBeCloseTo(0);
    expect(() =>
      invertTransform({
        ...identityTransform(),
        scale: { x: 0, y: 1, z: 1 },
      }),
    ).toThrow(SingularTransformError);
    expect(
      tryInvertTransform({
        ...identityTransform(),
        scale: { x: 0, y: 1, z: 1 },
      }),
    ).toBeUndefined();
    const restored = invertTransform(transform);
    const product = multiplyTransforms(transform, restored);
    const matrix = composeTransform(product);
    expect(matrix.elements[0]).toBeCloseTo(1);
  });
});
