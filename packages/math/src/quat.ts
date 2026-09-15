import { assertFinite, nearlyEqual } from "./scalar";
import { Vector3, type Vec3 } from "./vec3";

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export class Quaternion implements Quat {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
    readonly w = 1,
  ) {
    assertFinite(x, "x");
    assertFinite(y, "y");
    assertFinite(z, "z");
    assertFinite(w, "w");
  }

  static readonly identity = new Quaternion(0, 0, 0, 1);

  static from(q: Quat): Quaternion {
    return q instanceof Quaternion ? q : new Quaternion(q.x, q.y, q.z, q.w);
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): Quaternion {
    const len = this.length();
    if (len === 0) {
      throw new RangeError("Cannot normalize a zero-length quaternion");
    }
    return new Quaternion(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  invert(): Quaternion {
    const ls = this.lengthSq();
    if (ls === 0) {
      throw new RangeError("Cannot invert a zero-length quaternion");
    }
    return new Quaternion(-this.x / ls, -this.y / ls, -this.z / ls, this.w / ls);
  }

  multiply(b: Quat): Quaternion {
    const ax = this.x;
    const ay = this.y;
    const az = this.z;
    const aw = this.w;
    return new Quaternion(
      aw * b.x + ax * b.w + ay * b.z - az * b.y,
      aw * b.y - ax * b.z + ay * b.w + az * b.x,
      aw * b.z + ax * b.y - ay * b.x + az * b.w,
      aw * b.w - ax * b.x - ay * b.y - az * b.z,
    );
  }

  rotateVector(v: Vec3): Vector3 {
    const qv = new Quaternion(v.x, v.y, v.z, 0);
    const r = this.multiply(qv).multiply(this.invert());
    return new Vector3(r.x, r.y, r.z);
  }

  static fromAxisAngle(axis: Vec3, angle: number): Quaternion {
    assertFinite(angle, "angle");
    const a = Vector3.from(axis).normalize();
    const half = angle / 2;
    const s = Math.sin(half);
    return new Quaternion(a.x * s, a.y * s, a.z * s, Math.cos(half));
  }

  /** Shortest rotation taking `from` onto `to`. */
  static fromTo(from: Vec3, to: Vec3): Quaternion {
    const a = Vector3.from(from).normalize();
    const b = Vector3.from(to).normalize();
    const c = a.cross(b);
    const w = 1 + a.dot(b);
    if (c.lengthSq() < 1e-12) {
      if (a.dot(b) > 0) {
        return Quaternion.identity;
      }
      const perp = Math.abs(a.x) < 0.9 ? new Vector3(1, 0, 0).cross(a) : new Vector3(0, 1, 0).cross(a);
      return Quaternion.fromAxisAngle(perp, Math.PI);
    }
    return new Quaternion(c.x, c.y, c.z, w).normalize();
  }

  static fromEulerXYZ(euler: Vec3): Quaternion {
    const hx = euler.x / 2;
    const hy = euler.y / 2;
    const hz = euler.z / 2;
    const cx = Math.cos(hx);
    const sx = Math.sin(hx);
    const cy = Math.cos(hy);
    const sy = Math.sin(hy);
    const cz = Math.cos(hz);
    const sz = Math.sin(hz);
    return new Quaternion(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    );
  }

  slerp(b: Quat, t: number): Quaternion {
    assertFinite(t, "t");
    let qx = b.x;
    let qy = b.y;
    let qz = b.z;
    let qw = b.w;
    let cosTheta = this.x * qx + this.y * qy + this.z * qz + this.w * qw;
    if (cosTheta < 0) {
      qx = -qx;
      qy = -qy;
      qz = -qz;
      qw = -qw;
      cosTheta = -cosTheta;
    }
    if (cosTheta > 0.9995) {
      return new Quaternion(
        this.x + (qx - this.x) * t,
        this.y + (qy - this.y) * t,
        this.z + (qz - this.z) * t,
        this.w + (qw - this.w) * t,
      ).normalize();
    }
    const theta = Math.acos(cosTheta);
    const sinTheta = Math.sin(theta);
    const w1 = Math.sin((1 - t) * theta) / sinTheta;
    const w2 = Math.sin(t * theta) / sinTheta;
    return new Quaternion(
      this.x * w1 + qx * w2,
      this.y * w1 + qy * w2,
      this.z * w1 + qz * w2,
      this.w * w1 + qw * w2,
    );
  }

  equals(b: Quat, epsilon = 1e-6): boolean {
    return (
      (nearlyEqual(this.x, b.x, epsilon) &&
        nearlyEqual(this.y, b.y, epsilon) &&
        nearlyEqual(this.z, b.z, epsilon) &&
        nearlyEqual(this.w, b.w, epsilon)) ||
      (nearlyEqual(this.x, -b.x, epsilon) &&
        nearlyEqual(this.y, -b.y, epsilon) &&
        nearlyEqual(this.z, -b.z, epsilon) &&
        nearlyEqual(this.w, -b.w, epsilon))
    );
  }

  toJSON(): Quat {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }
}
