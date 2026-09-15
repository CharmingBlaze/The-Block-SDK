import { assertFinite, nearlyEqual } from "./scalar";
import { Vector3, type Vec3 } from "./vec3";

export type EulerOrder = "XYZ";

export class Euler {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
    readonly order: EulerOrder = "XYZ",
  ) {
    assertFinite(x, "x");
    assertFinite(y, "y");
    assertFinite(z, "z");
  }

  static fromVec3(v: Vec3, order: EulerOrder = "XYZ"): Euler {
    return new Euler(v.x, v.y, v.z, order);
  }

  toVec3(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  equals(b: Euler, epsilon = 1e-6): boolean {
    return (
      this.order === b.order &&
      nearlyEqual(this.x, b.x, epsilon) &&
      nearlyEqual(this.y, b.y, epsilon) &&
      nearlyEqual(this.z, b.z, epsilon)
    );
  }
}
