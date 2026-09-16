# Geometry predicates vs GeometryTolerance

**Package:** `@modeling-kit/math`  
**Implementation:** `packages/math/src/predicates.ts`  
**Library:** `robust-predicates` (`orient2d`, `orient3d` only)

The mesh kernel stays the canonical geometry. These predicates are an internal sign oracle, not a second math or mesh system.

## Ownership and conversion boundary

| Layer | Owns |
| --- | --- |
| `robust-predicates` | Adaptive exact 2D/3D orientation determinants |
| `GeometryPredicates` | SDK-facing wrappers, Y-up CCW convention, 2D helpers |
| `@modeling-kit/mesh` | When to ask for a sign vs a distance |
| `GeometryTolerance` | Magnitude thresholds on `MeshOperationContext` |

Callers import from `@modeling-kit/math`. They must not import `robust-predicates` directly.

The published `robust-predicates` functions assume a Y-down frame. The wrapper **negates** both `orient2d` and `orient3d` so they match this SDK: right-handed, Y-up, CCW-positive. That is the same sign as a 2D cross product and a right-handed tetrahedron volume.

There is no lifecycle, cache, worker, or WASM instance. Failed classification throws on non-finite input and does not mutate meshes.

## When to use robust predicates

Use `orient2d` / `orient3d` (or the helpers on `defaultGeometryPredicates`) when the *sign* of a geometric test decides topology or winding:

- Projected polygon orientation and winding
- Ear-clip convexity and point-in-ear
- Proper segment intersection (interiors cross)
- Exact collinearity (`isCollinear2d` / `isCollinear3d`)
- Exact coplanarity (`isCoplanar`)
- Planar turn classification (`planarTurnSign`) for inset concavity and convex quads
- Knife/split “which side / parallel / inside face” decisions

Positive `orient2d(a, b, c)` means `abc` is counter-clockwise. Positive `orient3d(a, b, c, d)` means `d` lies on the normal side of CCW triangle `abc`.

## When to use GeometryTolerance

Keep `MeshOperationContext.tolerance` (`epsilon`, `angleEpsilon`) and other documented thresholds for *magnitudes*:

| Decision | Why it is not a predicate |
| --- | --- |
| Weld / merge distance | User snap radius |
| Knife snap radius | Distance to vertex/edge |
| Near-duplicate vertex collapse | Length compared to `epsilon` |
| Near-collinear cleanup on a polygon | `crossLen <= epsilon * denom` |
| Coplanar *grow* across a noisy grid | Angle plus plane distance fallback |
| Inset inversion by grown area | `abs(next) > abs(orig) * 1.05` |
| Degenerate face area | Length of Newell normal vs `epsilon` |

Nearly collinear or nearly coplanar input is still a tolerance question. Predicates answer “which side” and “exactly zero”; they do not invent a user-facing snap distance.

## Failure and performance

- Non-finite coordinates throw `RangeError`. Callers that mutate meshes must validate first; a throw inside an operator still goes through `runTransactionalMeshOp`.
- Adaptive exact arithmetic uses ordinary floats on the easy path. The slow path runs only when the determinant is too close to zero for a reliable sign.
- Results are deterministic for the same IEEE inputs.

## Public API

Additive exports from `@modeling-kit/math` (re-exported by `@modeling-kit/sdk`): `orient2d`, `orient3d`, `orientation2d`, `orientation3d`, `defaultGeometryPredicates`, and the helper functions used by mesh and selection. Existing `GeometryTolerance` fields are unchanged.
