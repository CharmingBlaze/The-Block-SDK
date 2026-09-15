import { assertFinite, nearlyEqual } from "./scalar";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class Vector3 implements Vec3 {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
  ) {
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      throw new RangeError("Vector3 components must not be NaN");
    }
  }

  static readonly zero = new Vector3(0, 0, 0);
  static readonly one = new Vector3(1, 1, 1);
  static readonly unitX = new Vector3(1, 0, 0);
  static readonly unitY = new Vector3(0, 1, 0);
  static readonly unitZ = new Vector3(0, 0, 1);

  static from(v: Vec3): Vector3 {
    return v instanceof Vector3 ? v : new Vector3(v.x, v.y, v.z);
  }

  static create(x = 0, y = 0, z = 0): Vector3 {
    return new Vector3(x, y, z);
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  add(b: Vec3): Vector3 {
    return new Vector3(this.x + b.x, this.y + b.y, this.z + b.z);
  }

  sub(b: Vec3): Vector3 {
    return new Vector3(this.x - b.x, this.y - b.y, this.z - b.z);
  }

  scale(s: number): Vector3 {
    if (!Number.isFinite(s)) {
      throw new RangeError("scale must be a finite number");
    }
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  negate(): Vector3 {
    return this.scale(-1);
  }

  dot(b: Vec3): number {
    return this.x * b.x + this.y * b.y + this.z * b.z;
  }

  cross(b: Vec3): Vector3 {
    return new Vector3(
      this.y * b.z - this.z * b.y,
      this.z * b.x - this.x * b.z,
      this.x * b.y - this.y * b.x,
    );
  }

  lengthSq(): number {
    return this.dot(this);
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  distanceTo(b: Vec3): number {
    return this.sub(b).length();
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) {
      throw new RangeError("Cannot normalize a zero-length vector");
    }
    return this.scale(1 / len);
  }

  lerp(b: Vec3, t: number): Vector3 {
    assertFinite(t, "t");
    return new Vector3(
      this.x + (b.x - this.x) * t,
      this.y + (b.y - this.y) * t,
      this.z + (b.z - this.z) * t,
    );
  }

  min(b: Vec3): Vector3 {
    return new Vector3(Math.min(this.x, b.x), Math.min(this.y, b.y), Math.min(this.z, b.z));
  }

  max(b: Vec3): Vector3 {
    return new Vector3(Math.max(this.x, b.x), Math.max(this.y, b.y), Math.max(this.z, b.z));
  }

  equals(b: Vec3, epsilon = 1e-6): boolean {
    return (
      nearlyEqual(this.x, b.x, epsilon) &&
      nearlyEqual(this.y, b.y, epsilon) &&
      nearlyEqual(this.z, b.z, epsilon)
    );
  }

  toJSON(): Vec3 {
    return { x: this.x, y: this.y, z: this.z };
  }
}
