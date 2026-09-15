import { Vector3, type Vec3 } from "./vec3";

export class BoundingBox {
  constructor(
    readonly min: Vector3,
    readonly max: Vector3,
  ) {}

  static empty(): BoundingBox {
    return new BoundingBox(
      new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );
  }

  static fromPoints(points: readonly Vec3[]): BoundingBox {
    let box = BoundingBox.empty();
    for (const point of points) {
      box = box.expandByPoint(point);
    }
    return box;
  }

  get isEmpty(): boolean {
    return this.min.x > this.max.x || this.min.y > this.max.y || this.min.z > this.max.z;
  }

  expandByPoint(p: Vec3): BoundingBox {
    return new BoundingBox(Vector3.from(this.min).min(p), Vector3.from(this.max).max(p));
  }

  union(other: BoundingBox): BoundingBox {
    if (this.isEmpty) {
      return other;
    }
    if (other.isEmpty) {
      return this;
    }
    return new BoundingBox(this.min.min(other.min), this.max.max(other.max));
  }

  containsPoint(p: Vec3): boolean {
    return (
      p.x >= this.min.x &&
      p.x <= this.max.x &&
      p.y >= this.min.y &&
      p.y <= this.max.y &&
      p.z >= this.min.z &&
      p.z <= this.max.z
    );
  }

  center(): Vector3 {
    if (this.isEmpty) {
      return Vector3.zero;
    }
    return this.min.add(this.max).scale(0.5);
  }

  size(): Vector3 {
    if (this.isEmpty) {
      return Vector3.zero;
    }
    return this.max.sub(this.min);
  }
}
