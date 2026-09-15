import { assertFinite, nearlyEqual } from "./scalar";
import { Euler } from "./euler";
import { Quaternion, type Quat } from "./quat";
import { Vector3, type Vec3 } from "./vec3";

/** Column-major 4×4 matrix, matching common WebGL/Three.js layout. */
export class Matrix4 {
  constructor(readonly elements: readonly number[]) {
    if (elements.length !== 16) {
      throw new RangeError("Matrix4 requires 16 elements");
    }
    for (const [i, value] of elements.entries()) {
      assertFinite(value, `elements[${i}]`);
    }
  }

  static identity(): Matrix4 {
    return new Matrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  clone(): Matrix4 {
    return new Matrix4([...this.elements]);
  }

  multiply(b: Matrix4): Matrix4 {
    const a = this.elements;
    const c = b.elements;
    const out = new Array<number>(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[row]! * c[col * 4]! +
          a[row + 4]! * c[col * 4 + 1]! +
          a[row + 8]! * c[col * 4 + 2]! +
          a[row + 12]! * c[col * 4 + 3]!;
      }
    }
    return new Matrix4(out);
  }

  static translation(v: Vec3): Matrix4 {
    return new Matrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v.x, v.y, v.z, 1]);
  }

  static scaling(v: Vec3): Matrix4 {
    return new Matrix4([v.x, 0, 0, 0, 0, v.y, 0, 0, 0, 0, v.z, 0, 0, 0, 0, 1]);
  }

  static fromQuaternion(q: Quat): Matrix4 {
    const x = q.x;
    const y = q.y;
    const z = q.z;
    const w = q.w;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    return new Matrix4([
      1 - (yy + zz),
      xy + wz,
      xz - wy,
      0,
      xy - wz,
      1 - (xx + zz),
      yz + wx,
      0,
      xz + wy,
      yz - wx,
      1 - (xx + yy),
      0,
      0,
      0,
      0,
      1,
    ]);
  }

  static compose(position: Vec3, rotation: Quat, scale: Vec3): Matrix4 {
    return Matrix4.translation(position)
      .multiply(Matrix4.fromQuaternion(rotation))
      .multiply(Matrix4.scaling(scale));
  }

  transformPoint(p: Vec3): Vector3 {
    const e = this.elements;
    const x = p.x;
    const y = p.y;
    const z = p.z;
    const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]!;
    if (w === 0) {
      throw new RangeError("Matrix4.transformPoint: w is zero");
    }
    return new Vector3(
      (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w,
      (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w,
      (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) / w,
    );
  }

  transformDirection(d: Vec3): Vector3 {
    const e = this.elements;
    return new Vector3(
      e[0]! * d.x + e[4]! * d.y + e[8]! * d.z,
      e[1]! * d.x + e[5]! * d.y + e[9]! * d.z,
      e[2]! * d.x + e[6]! * d.y + e[10]! * d.z,
    );
  }

  determinant(): number {
    const m = this.elements;
    const n11 = m[0]!,
      n21 = m[1]!,
      n31 = m[2]!,
      n41 = m[3]!;
    const n12 = m[4]!,
      n22 = m[5]!,
      n32 = m[6]!,
      n42 = m[7]!;
    const n13 = m[8]!,
      n23 = m[9]!,
      n33 = m[10]!,
      n43 = m[11]!;
    const n14 = m[12]!,
      n24 = m[13]!,
      n34 = m[14]!,
      n44 = m[15]!;
    return (
      n41 *
        (+n14 * n23 * n32 -
          n13 * n24 * n32 -
          n14 * n22 * n33 +
          n12 * n24 * n33 +
          n13 * n22 * n34 -
          n12 * n23 * n34) +
      n42 *
        (+n11 * n23 * n34 -
          n11 * n24 * n33 +
          n14 * n21 * n33 -
          n13 * n21 * n34 +
          n13 * n24 * n31 -
          n14 * n23 * n31) +
      n43 *
        (+n11 * n24 * n32 -
          n11 * n22 * n34 -
          n14 * n21 * n32 +
          n12 * n21 * n34 +
          n14 * n22 * n31 -
          n12 * n24 * n31) +
      n44 *
        (-n13 * n22 * n31 -
          n11 * n23 * n32 +
          n11 * n22 * n33 +
          n13 * n21 * n32 -
          n12 * n21 * n33 +
          n12 * n23 * n31)
    );
  }

  invert(): Matrix4 {
    const m = this.elements;
    const n11 = m[0]!,
      n21 = m[1]!,
      n31 = m[2]!,
      n41 = m[3]!;
    const n12 = m[4]!,
      n22 = m[5]!,
      n32 = m[6]!,
      n42 = m[7]!;
    const n13 = m[8]!,
      n23 = m[9]!,
      n33 = m[10]!,
      n43 = m[11]!;
    const n14 = m[12]!,
      n24 = m[13]!,
      n34 = m[14]!,
      n44 = m[15]!;

    const t11 =
      n23 * n34 * n42 -
      n24 * n33 * n42 +
      n24 * n32 * n43 -
      n22 * n34 * n43 -
      n23 * n32 * n44 +
      n22 * n33 * n44;
    const t12 =
      n14 * n33 * n42 -
      n13 * n34 * n42 -
      n14 * n32 * n43 +
      n12 * n34 * n43 +
      n13 * n32 * n44 -
      n12 * n33 * n44;
    const t13 =
      n13 * n24 * n42 -
      n14 * n23 * n42 +
      n14 * n22 * n43 -
      n12 * n24 * n43 -
      n13 * n22 * n44 +
      n12 * n23 * n44;
    const t14 =
      n14 * n23 * n32 -
      n13 * n24 * n32 -
      n14 * n22 * n33 +
      n12 * n24 * n33 +
      n13 * n22 * n34 -
      n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) {
      throw new RangeError("Matrix4 is not invertible");
    }
    const invDet = 1 / det;

    return new Matrix4([
      t11 * invDet,
      (n24 * n33 * n41 -
        n23 * n34 * n41 -
        n24 * n31 * n43 +
        n21 * n34 * n43 +
        n23 * n31 * n44 -
        n21 * n33 * n44) *
        invDet,
      (n22 * n34 * n41 -
        n24 * n32 * n41 +
        n24 * n31 * n42 -
        n21 * n34 * n42 -
        n22 * n31 * n44 +
        n21 * n32 * n44) *
        invDet,
      (n23 * n32 * n41 -
        n22 * n33 * n41 -
        n23 * n31 * n42 +
        n21 * n33 * n42 +
        n22 * n31 * n43 -
        n21 * n32 * n43) *
        invDet,
      t12 * invDet,
      (n13 * n34 * n41 -
        n14 * n33 * n41 +
        n14 * n31 * n43 -
        n11 * n34 * n43 -
        n13 * n31 * n44 +
        n11 * n33 * n44) *
        invDet,
      (n14 * n32 * n41 -
        n12 * n34 * n41 -
        n14 * n31 * n42 +
        n11 * n34 * n42 +
        n12 * n31 * n44 -
        n11 * n32 * n44) *
        invDet,
      (n12 * n33 * n41 -
        n13 * n32 * n41 +
        n13 * n31 * n42 -
        n11 * n33 * n42 -
        n12 * n31 * n43 +
        n11 * n32 * n43) *
        invDet,
      t13 * invDet,
      (n14 * n23 * n41 -
        n13 * n24 * n41 -
        n14 * n21 * n43 +
        n11 * n24 * n43 +
        n13 * n21 * n44 -
        n11 * n23 * n44) *
        invDet,
      (n12 * n24 * n41 -
        n14 * n22 * n41 +
        n14 * n21 * n42 -
        n11 * n24 * n42 -
        n12 * n21 * n44 +
        n11 * n22 * n44) *
        invDet,
      (n13 * n22 * n41 -
        n12 * n23 * n41 -
        n13 * n21 * n42 +
        n11 * n23 * n42 +
        n12 * n21 * n43 -
        n11 * n22 * n43) *
        invDet,
      t14 * invDet,
      (n13 * n24 * n31 -
        n14 * n23 * n31 +
        n14 * n21 * n33 -
        n11 * n24 * n33 -
        n13 * n21 * n34 +
        n11 * n23 * n34) *
        invDet,
      (n14 * n22 * n31 -
        n12 * n24 * n31 -
        n14 * n21 * n32 +
        n11 * n24 * n32 +
        n12 * n21 * n34 -
        n11 * n22 * n34) *
        invDet,
      (n12 * n23 * n31 -
        n13 * n22 * n31 +
        n13 * n21 * n32 -
        n11 * n23 * n32 -
        n12 * n21 * n33 +
        n11 * n22 * n33) *
        invDet,
    ]);
  }

  decompose(): { position: Vector3; rotation: Quaternion; scale: Vector3 } {
    const e = this.elements;
    const position = new Vector3(e[12]!, e[13]!, e[14]!);
    let sx = new Vector3(e[0]!, e[1]!, e[2]!).length();
    const sy = new Vector3(e[4]!, e[5]!, e[6]!).length();
    const sz = new Vector3(e[8]!, e[9]!, e[10]!).length();
    const det = this.determinant();
    if (det < 0) {
      sx = -sx;
    }
    if (sx === 0 || sy === 0 || sz === 0) {
      throw new RangeError("Cannot decompose a matrix with a zero scale axis");
    }
    const rotationMatrix = new Matrix4([
      e[0]! / sx,
      e[1]! / sx,
      e[2]! / sx,
      0,
      e[4]! / sy,
      e[5]! / sy,
      e[6]! / sy,
      0,
      e[8]! / sz,
      e[9]! / sz,
      e[10]! / sz,
      0,
      0,
      0,
      0,
      1,
    ]);
    return {
      position,
      rotation: quaternionFromRotationMatrix(rotationMatrix),
      scale: new Vector3(sx, sy, sz),
    };
  }

  equals(b: Matrix4, epsilon = 1e-6): boolean {
    return this.elements.every((value, i) => nearlyEqual(value, b.elements[i]!, epsilon));
  }
}

function quaternionFromRotationMatrix(m: Matrix4): Quaternion {
  const te = m.elements;
  const m11 = te[0]!,
    m21 = te[1]!,
    m31 = te[2]!;
  const m12 = te[4]!,
    m22 = te[5]!,
    m32 = te[6]!;
  const m13 = te[8]!,
    m23 = te[9]!,
    m33 = te[10]!;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return new Quaternion((m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s);
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return new Quaternion(0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s);
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return new Quaternion((m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s);
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return new Quaternion((m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s);
}

export function eulerFromQuaternion(q: Quat): Euler {
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * (Math.PI / 2);
  } else {
    pitch = Math.asin(sinp);
  }
  const roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
  const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
  return new Euler(roll, pitch, yaw, "XYZ");
}
