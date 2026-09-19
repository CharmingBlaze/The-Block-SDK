# @modeling-kit/rigging

**Skeleton and skinning system (preview authoring).** Defines bones with rest/inverse-bind matrices, vertex weight assignment, and world-pose computation.

## Purpose

The `rigging` package provides the canonical skeleton data model for the SDK:

- **SkeletonBuilder** — programmatic bone hierarchy construction with parent-child relationships
- **Bone data** — each bone has a name, parent reference, local rest transform, and inverse bind matrix
- **Vertex weights** — assign up to 4 bone influences per vertex with normalized weight sums
- **Pose computation** — `restPose`, `worldPose` compute bone matrices from local transforms
- **Validation** — `validateSkeletonData`, `assertNoParentCycles` ensure skeleton integrity
- **Hierarchy utilities** — `collectRootBoneIds`, `orderBonesStable`, `reparentBone`

## Key Exports

```ts
import {
  SkeletonBuilder, type AddBoneOptions,
  reparentBone,
  skeletonFromData, skeletonToData,
} from "@modeling-kit/rigging";

// Types
import type {
  Bone, BoneWeight, MeshSkinningData,
  Skeleton, PoseMap, WorldPose,
  VertexSkinWeights,
} from "@modeling-kit/rigging";

// Hierarchy
import {
  collectRootBoneIds, orderBonesStable, assertNoParentCycles,
} from "@modeling-kit/rigging";

// Poses
import { restPose, identityLocalPose } from "@modeling-kit/rigging";

// Validation
import {
  assertValidSkeletonData, validateSkeletonData,
  validateRestTransform, type SkeletonIssue,
} from "@modeling-kit/rigging";

// Constants
import {
  DEFAULT_MAX_BONE_INFLUENCES,
  WEIGHT_SUM_EPSILON,
  WEIGHT_ZERO_EPSILON,
} from "@modeling-kit/rigging";
```

## Usage Example

```ts
import { SkeletonBuilder } from "@modeling-kit/rigging";

const builder = new SkeletonBuilder();

// Build a simple arm skeleton
const root = builder.addBone({ name: "Root" });
const shoulder = builder.addBone({ name: "Shoulder", parentId: root });
const elbow = builder.addBone({
  name: "Elbow",
  parentId: shoulder,
  restPosition: [0, 0.5, 0], // local translation from parent
});
const wrist = builder.addBone({
  name: "Wrist",
  parentId: elbow,
  restPosition: [0, 0.5, 0],
});

const skeleton = builder.build();
console.log(skeleton.bones.size); // 4
```

## Architecture Notes

- Skeletons are stored as part of the **document** (`SkeletonData` in `EntityStore`).
- Each `Bone` has a **local rest transform** (position, rotation, scale relative to parent) from which world-space matrices are derived.
- The **inverse bind matrix** (`invBind`) is computed from the rest pose and used for skinning — it maps vertices from world space to bone-local space.
- **Up to 4 bone influences per vertex** (configurable via `DEFAULT_MAX_BONE_INFLUENCES`). Weights are normalized to sum to 1.0.
- See `docs/architecture/RIGGING.md` and `docs/architecture/SKINNING.md` for detailed specifications.
- This is **preview authoring** — production rigging (IK, constraints, drivers) is beyond the SDK's scope.