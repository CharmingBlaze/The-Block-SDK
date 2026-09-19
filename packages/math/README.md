# @modeling-kit/math

**Linear algebra and computational geometry for The Block SDK.** Provides 3D vector, matrix, quaternion, ray, and bounding-box types, plus robust geometric predicates and a raycasting BVH.

## Purpose

The `math` package is the numeric backbone of the SDK. It supplies:

- **Vector3, Matrix4, Quaternion** — standard 3D math types with full method suites.
- **Euler angles** — with configurable rotation order.
- **Ray** — origin/direction tuple with standard intersection helpers.
- **BoundingBox** — axis-aligned bounding box with union, intersection, and containment queries.
- **Geometric predicates** — `orient2d`, `orient3d`, `pointInPolygonEvenOdd2d`, `segmentsIntersectProper2d` — essential for topology operations.
- **BVH** — `buildAabbBvh`, `raycastAabbBvh`, `refitAabbBvh` for accelerating spatial queries against triangle meshes.
- **Scalar utilities** — `nearlyEqual` for floating-point comparison with tolerance.

## Key Exports

```ts
import {
  Vector3, type Vec3,
  Matrix4,
  Quaternion, type Quat,
  Euler, type EulerOrder,
  Ray,
  BoundingBox,
  // Scalar
  assertFinite, nearlyEqual,
  // Transforms
  identityTransform, matrixToTransform, transformToMatrix, type TransformData,
  // Predicates
  orient2d, orient3d, orient2dPoints, orient3dPoints,
  isCollinear2d, isCollinear3d, isCoplanar,
  pointInPolygonEvenOdd2d, pointInTriangleCCW2d,
  planarTurnSign, polygonTwiceSignedArea2d, polygonWinding2d,
  segmentsIntersectProper2d,
  projectPointToOrientedPlane2d,
  defaultGeometryPredicates, type GeometryPredicates,
  // BVH
  buildAabbBvh, raycastAabbBvh, refitAabbBvh,
  boxHitDistance, rayIntersectTriangle, rayIntersectIndexedTriangle,
  triangleBounds, triangleBoundsFromPositions, unionPrimitiveBounds,
  BVH_MAX_LEAF_SIZE,
  type BvhNode, type BvhLeaf, type BvhBranch, type BvhPrimitive, type BvhRayHit,
} from "@modeling-kit/math";
```

## Usage Example

```ts
import { Vector3, Matrix4, Quaternion } from "@modeling-kit/math";

// Vector operations
const a = new Vector3(1, 2, 3);
const b = new Vector3(4, 5, 6);
const cross = a.cross(b);
const normalized = a.normalize();

// Matrix chain
const m = new Matrix4()
  .compose(new Vector3(2, 0, 0), new Quaternion().identity(), new Vector3(1, 1, 1));
const transformed = a.applyMatrix4(m);

// Quaternion rotation
const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const rotated = a.clone().applyQuaternion(q);
```

```ts
import { orient2d, pointInTriangleCCW2d } from "@modeling-kit/math";

// Robust 2D orientation test (returns -1, 0, or 1)
const sign = orient2d([0, 0], [1, 0], [0.5, 0.5]); // 1 (counter-clockwise)

// Point-in-triangle test
const inside = pointInTriangleCCW2d(
  [0.25, 0.25],
  [0, 0], [1, 0], [0, 1]
); // true
```

## Architecture Notes

- Math types use **value semantics**: methods return new instances rather than mutating in place (except for explicit mutators).
- The **BVH** is a generic AABB hierarchy that stores arbitrary primitives with bounds — it's used by the mesh kernel for local spatial queries and by the three-adapter for viewport hit testing.
- Predicates use **robust adaptive floating-point** arithmetic via the `robust-predicates` dependency, ensuring topology operations are numerically stable.
- `nearlyEqual` uses a relative epsilon of `1e-12` by default, suitable for most geometry work.