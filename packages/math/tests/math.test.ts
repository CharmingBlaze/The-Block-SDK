import { describe, expect, it } from "vitest";
import { BoundingBox } from "../src/bbox";
import { Matrix4 } from "../src/mat4";
import { Quaternion } from "../src/quat";
import { Ray } from "../src/ray";
import { identityTransform, matrixToTransform, transformToMatrix } from "../src/transform";
import { Vector3 } from "../src/vec3";

describe("Vector3", () => {
  it("adds and rejects NaN", () => {
    expect(new Vector3(1, 2, 3).add({ x: 4, y: 5, z: 6 }).equals(new Vector3(5, 7, 9))).toBe(true);
    expect(() => new Vector3(Number.NaN, 0, 0)).toThrow(/NaN/);
  });

  it("computes cross and normalize", () => {
    const n = Vector3.unitX.cross(Vector3.unitY).normalize();
    expect(n.equals(Vector3.unitZ)).toBe(true);
  });
});

describe("Quaternion and Matrix4", () => {
  it("rotates a vector around Y by 90 degrees", () => {
    const q = Quaternion.fromAxisAngle(Vector3.unitY, Math.PI / 2);
    const rotated = q.rotateVector(Vector3.unitX);
    expect(rotated.equals(new Vector3(0, 0, -1), 1e-5)).toBe(true);
  });

  it("composes and decomposes TRS", () => {
    const transform = {
      position: { x: 1, y: 2, z: 3 },
      rotation: Quaternion.fromAxisAngle(Vector3.unitY, 0.4).toJSON(),
      scale: { x: 2, y: 3, z: 4 },
    };
    const roundTrip = matrixToTransform(transformToMatrix(transform));
    expect(Vector3.from(roundTrip.position).equals(Vector3.from(transform.position), 1e-5)).toBe(
      true,
    );
    expect(Vector3.from(roundTrip.scale).equals(Vector3.from(transform.scale), 1e-5)).toBe(true);
    expect(
      Quaternion.from(roundTrip.rotation).equals(Quaternion.from(transform.rotation), 1e-5),
    ).toBe(true);
  });

  it("inverts a translation matrix", () => {
    const m = Matrix4.translation(new Vector3(3, 0, 0));
    const p = m.invert().transformPoint(new Vector3(5, 0, 0));
    expect(p.equals(new Vector3(2, 0, 0))).toBe(true);
  });
});

describe("BoundingBox and Ray", () => {
  it("builds a box from points and reports containment", () => {
    const box = BoundingBox.fromPoints([
      { x: -1, y: 0, z: 0 },
      { x: 2, y: 4, z: 1 },
    ]);
    expect(box.containsPoint({ x: 0, y: 1, z: 0.5 })).toBe(true);
    expect(box.containsPoint({ x: 10, y: 0, z: 0 })).toBe(false);
    expect(box.size().equals(new Vector3(3, 4, 1))).toBe(true);
    expect(BoundingBox.fromMinMax({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }).containsPoint({ x: 0.5, y: 0.5, z: 0.5 })).toBe(true);
  });

  it("intersects an AABB", () => {
    const box = BoundingBox.fromPoints([
      { x: 1, y: -1, z: -1 },
      { x: 2, y: 1, z: 1 },
    ]);
    const ray = new Ray(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
    expect(ray.intersectBox(box)).toBeCloseTo(1);
    const miss = new Ray(new Vector3(0, 5, 0), new Vector3(1, 0, 0));
    expect(miss.intersectBox(box)).toBeNull();
  });

  it("round-trips identity transform", () => {
    const m = transformToMatrix(identityTransform());
    expect(m.equals(Matrix4.identity())).toBe(true);
  });
});
