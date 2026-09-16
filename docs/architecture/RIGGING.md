# Rigging

Canonical skeleton and skin **data** live in `@modeling-kit/document`. Runtime evaluation lives in `@modeling-kit/rigging`. Three.js types must not appear in either package.

## Stability

**Stable**

- Bone IDs, skeleton IDs, unique-id validation
- Hierarchy (forest: multiple roots are allowed; `parentId === null` is a root)
- Rest transforms (finite, normalized rotations, nonzero scale)
- Inverse bind matrices (authored on the skin binding, or rest-pose inverses on bones)
- Skin bindings, joint indices mapped to `BoneId`, joint weights
- Weight validation and the single canonical normalizer
- Deterministic serialization (`skeletonToData` / `skeletonFromData`)

**Preview**

- Automatic skin weighting
- Weight painting tools
- IK, constraints, control rigs, retargeting

## Package ownership

| Concern | Package |
| --- | --- |
| `SkeletonData`, `BoneData`, `MeshSkinBinding` | `@modeling-kit/document` |
| Hierarchy, rest pose, IBM resolution, LBS | `@modeling-kit/rigging` |
| `THREE.Bone` / `THREE.Skeleton` / `THREE.SkinnedMesh` | `@modeling-kit/three-adapter` |
| glTF joints / `JOINTS_0` / `WEIGHTS_0` | `@modeling-kit/formats` |

## Multiple roots

A skeleton is a **forest**. Multiple bones with `parentId === null` are valid. Empty skeletons have zero roots. Cycles and missing parents are rejected.

## Inverse bind matrices

Do not treat IBMs as optional decoration.

- SDK-created skeletons store `inverseBindMatrix = inverse(jointWorldRestMatrix)` on each runtime bone.
- When `MeshSkinBinding.inverseBindMatrices` is present, evaluators use those authored matrices and fall back to **identity** for missing bones (glTF omitted-IBM behavior).
- When the map is omitted, evaluators use rest-pose inverses from the skeleton.
- Imported IBMs are not recomputed unless a future repair mode requests it.

## Weights

Default maximum influences is **4** (glTF compatible). `normalizeWeightsWithReport` is the only normalizer: drop non-positive weights, combine duplicates, sort deterministically, truncate, normalize, report dropped influences. Empty results throw unless `fallbackBoneId` is provided.

Export to glTF reports `skin-influence-truncated` when a vertex had more than four influences.
